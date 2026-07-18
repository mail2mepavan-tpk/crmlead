import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  Mail,
  Download,
  Eye,
} from 'lucide-react';
import {
  getSalesOrders,
  deleteSalesOrder,
  getSalesOrdersSummary,
  generateSalesOrderPDF,
  sendSalesOrderEmail,
} from '../utils/salesOrderStorage';

const statusColors = {
  'Pending': 'bg-amber-100 text-amber-800 border-amber-300',
  'Sent': 'bg-blue-100 text-blue-800 border-blue-300',
  'Accepted': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Rejected': 'bg-red-100 text-red-800 border-red-300',
};

export default function SalesOrdersDashboard() {
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({ totalOrders: 0, totalOrderAmount: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [popup, setPopup] = useState({ type: '', order: null });
  const [emailForm, setEmailForm] = useState({ recipients: '', subject: '' });
  const [attachments, setAttachments] = useState([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await getSalesOrders();
        setOrders(data);
        setSummary(getSalesOrdersSummary(data));
      } catch (err) {
        setError(err.message || 'Failed to load sales orders');
        setOrders([]);
        setSummary({ totalOrders: 0, totalOrderAmount: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  async function loadOrders() {
    try {
      setLoading(true);
      setError('');
      const data = await getSalesOrders();
      setOrders(data);
      setSummary(getSalesOrdersSummary(data));
    } catch (err) {
      setError(err.message || 'Failed to load sales orders');
      setOrders([]);
      setSummary({ totalOrders: 0, totalOrderAmount: 0 });
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = async (id, orderNumber) => {
    if (!window.confirm(`Delete sales order "${orderNumber}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteSalesOrder(id);
      await loadOrders();
    } catch (err) {
      alert('Error deleting sales order: ' + err.message);
    }
  };

  const filtered = orders.filter((order) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return [
      order.salesOrder?.salesOrderNumber,
      order.customer?.customerName,
      order.customer?.email,
      order.status,
    ]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(term));
  });

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
  };

  const handleAttachmentChange = (event) => {
    const files = Array.from(event.target.files || []);
    const readFiles = files.map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              name: file.name,
              contentType: file.type || 'application/octet-stream',
              contentInBase64: reader.result.split(',')[1],
              size: file.size,
            });
          };
          reader.onerror = () => reject(new Error(`Unable to read ${file.name}`));
          reader.readAsDataURL(file);
        })
    );

    Promise.all(readFiles)
      .then((resolvedFiles) => {
        setAttachments(resolvedFiles);
      })
      .catch((attachmentError) => {
        setEmailError(attachmentError.message);
      });
  };

  const removeAttachment = (index) => setAttachments((prev) => prev.filter((_, i) => i !== index));

  const handleDownloadPDF = async (order) => {
    try {
      const response = await generateSalesOrderPDF(order.id);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SalesOrder_${order.salesOrder?.salesOrderNumber || order.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      alert('Error downloading PDF: ' + err.message);
    }
  };

  const handleViewPDF = async (order) => {
    try {
      const response = await generateSalesOrderPDF(order.id);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    } catch (err) {
      alert('Error viewing PDF: ' + err.message);
    }
  };

  const handleSendEmail = async () => {
    if (!emailForm.recipients.trim()) {
      setEmailError('Please enter recipient email addresses');
      return;
    }

    setSendingEmail(true);
    setEmailError('');

    try {
      const recipients = emailForm.recipients
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);

      await sendSalesOrderEmail(popup.order.id, {
        recipients,
        subject: emailForm.subject,
        attachments,
      });

      setPopup({ type: '', order: null });
      setEmailForm({ recipients: '', subject: '' });
      setAttachments([]);
      alert('Email sent successfully!');
    } catch (err) {
      setEmailError('Error sending email: ' + err.message);
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-surface">
        <Loader2 className="size-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-surface px-5 py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-800">Sales Orders</h2>
            <p className="mt-1 text-sm text-slate-500">
              Create and manage sales orders converted from quotations.
            </p>
          </div>
          {/* <Link
            to="/sales-orders/new"
            className="inline-flex items-center gap-2 rounded bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white no-underline transition-all hover:bg-sky-600"
          >
            <Plus className="size-4" />
            New Sales Order
          </Link> */}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="flex items-center gap-4 rounded-lg bg-white p-5 shadow-sm">
            <FileText className="size-10 shrink-0 text-brand" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Total Order Amount
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800">
                ₹{summary.totalOrderAmount.toLocaleString('en-IN')}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {summary.totalOrders} sales orders
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <div className="flex items-center gap-2">
              <Search className="size-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by order number, customer, email, or status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Order #</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Customer</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Amount</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Date</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-sm text-slate-500">
                      No sales orders found
                    </td>
                  </tr>
                ) : (
                  filtered.map((order) => (
                    <tr key={order.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {order.salesOrder?.salesOrderNumber || order.id}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div>{order.customer?.customerName}</div>
                        <div className="text-xs text-slate-500">{order.customer?.email}</div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        ₹{order.totals?.grandTotal?.toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`inline-block rounded-full px-3 py-1 text-xs font-medium border ${
                            statusColors[order.status] || 'bg-slate-100 text-slate-800 border-slate-300'
                          }`}
                        >
                          {order.status || 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {order.salesOrder?.salesOrderDate ? new Date(order.salesOrder.salesOrderDate).toLocaleDateString('en-IN') : ''}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewPDF(order)}
                            className="rounded p-2 hover:bg-slate-100 transition-colors"
                            title="View PDF"
                          >
                            <Eye className="size-4 text-slate-600" />
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(order)}
                            className="rounded p-2 hover:bg-slate-100 transition-colors"
                            title="Download PDF"
                          >
                            <Download className="size-4 text-slate-600" />
                          </button>
                          <button
                            onClick={() => {
                              setPopup({ type: 'email', order });
                              setEmailForm({
                                recipients: order.customer?.email || '',
                                subject: `Sales Order ${order.salesOrder?.salesOrderNumber}`,
                              });
                              setAttachments([]);
                            }}
                            className="rounded p-2 hover:bg-slate-100 transition-colors"
                            title="Send Email"
                          >
                            <Mail className="size-4 text-slate-600" />
                          </button>
                          <Link
                            to={`/sales-orders/${order.id}/edit`}
                            className="rounded p-2 hover:bg-slate-100 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="size-4 text-slate-600" />
                          </Link>
                          <button
                            onClick={() => handleDelete(order.id, order.salesOrder?.salesOrderNumber || order.id)}
                            className="rounded p-2 hover:bg-slate-100 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="size-4 text-slate-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {popup.type === 'email' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-lg">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Send Order Acknowledgement Email</h3>
            </div>

            <div className="space-y-4 px-6 py-4">
              {emailError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {emailError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Recipients (comma-separated)
                </label>
                <textarea
                  rows="2"
                  value={emailForm.recipients}
                  onChange={(e) => setEmailForm({ ...emailForm, recipients: e.target.value })}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-3 focus:ring-sky-500/10"
                  placeholder="email1@example.com, email2@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-3 focus:ring-sky-500/10"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Attach additional PDFs</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => document.getElementById('sales-order-attach-input')?.click()}
                    className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Attach PDFs
                  </button>
                  <span className="text-xs text-slate-500">PDF only — up to 5 files</span>
                </div>
                <input
                  id="sales-order-attach-input"
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={handleAttachmentChange}
                  className="sr-only"
                />

                {attachments.length > 0 && (
                  <div className="mt-3 space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
                    {attachments.map((attachment, index) => (
                      <div key={`${attachment.name}-${index}`} className="flex items-center justify-between gap-3 rounded bg-white px-3 py-2 shadow-sm">
                        <div className="min-w-0 overflow-hidden text-sm text-slate-700">
                          <div className="truncate font-medium">{attachment.name}</div>
                          <div className="truncate text-xs text-slate-500">{attachment.contentType} · {formatFileSize(attachment.size)}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => setPopup({ type: '', order: null })}
                className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                disabled={sendingEmail}
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="inline-flex items-center gap-2 rounded bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-sky-600 disabled:opacity-50"
              >
                {sendingEmail ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="size-4" />
                    Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
