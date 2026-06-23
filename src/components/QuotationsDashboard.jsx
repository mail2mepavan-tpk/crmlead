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
  getQuotes,
  deleteQuote,
  getQuotesSummary,
  sendQuoteEmail,
  generateQuotePDF,
} from '../utils/quoteStorage';
import { useAuth } from '../context/AuthContext';

const statusColors = {
  'Pending': 'bg-amber-100 text-amber-800 border-amber-300',
  'Sent': 'bg-blue-100 text-blue-800 border-blue-300',
  'Accepted': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Rejected': 'bg-red-100 text-red-800 border-red-300',
};

const modalButtonClass =
  'rounded border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50';

export default function QuotationsDashboard() {
  const { isAdmin } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [summary, setSummary] = useState({ total: 0, pending: 0, sent: 0, accepted: 0, rejected: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [popup, setPopup] = useState({ type: '', quote: null });
  const [emailForm, setEmailForm] = useState({ recipients: '', subject: '', message: '' });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    loadQuotes();
  }, []);

  const loadQuotes = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getQuotes();
      setQuotes(data);
      setSummary(getQuotesSummary(data));
    } catch (err) {
      setError(err.message || 'Failed to load quotes');
      setQuotes([]);
      setSummary({ total: 0, pending: 0, sent: 0, accepted: 0, rejected: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, quoteNumber) => {
    if (!window.confirm(`Delete quotation "${quoteNumber}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteQuote(id);
      await loadQuotes();
    } catch (err) {
      alert('Error deleting quotation: ' + err.message);
    }
  };

  const handleDownloadPDF = async (quote) => {
    try {
      const response = await generateQuotePDF(quote.id);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Quote_${quote.quotation.quoteNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      alert('Error downloading PDF: ' + err.message);
    }
  };

  const handleViewPDF = async (quote) => {
    try {
      const response = await generateQuotePDF(quote.id);
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
      const recipients = emailForm.recipients.split(',').map(e => e.trim());
      await sendQuoteEmail(popup.quote.id, { recipients, subject: emailForm.subject, message: emailForm.message });
      
      // Update quote status to "Sent"
      await loadQuotes();
      setPopup({ type: '', quote: null });
      setEmailForm({ recipients: '', subject: '', message: '' });
      alert('Email sent successfully!');
    } catch (err) {
      setEmailError('Error sending email: ' + err.message);
    } finally {
      setSendingEmail(false);
    }
  };

  const filtered = quotes.filter((quote) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return [
      quote.quotation?.quoteNumber,
      quote.customer?.customerName,
      quote.customer?.email,
      quote.status,
    ]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(term));
  });

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
            <h2 className="text-2xl font-semibold text-slate-800">Quotations</h2>
            <p className="mt-1 text-sm text-slate-500">
              Create and manage customer quotations with PDF generation and email delivery.
            </p>
          </div>
          <Link
            to="/quotations/new"
            className="inline-flex items-center gap-2 rounded bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white no-underline transition-all hover:bg-sky-600"
          >
            <Plus className="size-4" />
            New Quotation
          </Link>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-5">
          <div className="flex items-center gap-4 rounded-lg bg-white p-5 shadow-sm">
            <FileText className="size-10 shrink-0 text-brand" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Total
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800">{summary.total}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-lg bg-white p-5 shadow-sm">
            <FileText className="size-10 shrink-0 text-amber-500" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Pending
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800">{summary.pending}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-lg bg-white p-5 shadow-sm">
            <FileText className="size-10 shrink-0 text-blue-500" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Sent
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800">{summary.sent}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-lg bg-white p-5 shadow-sm">
            <FileText className="size-10 shrink-0 text-emerald-500" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Accepted
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800">{summary.accepted}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-lg bg-white p-5 shadow-sm">
            <FileText className="size-10 shrink-0 text-red-500" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Rejected
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800">{summary.rejected}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <div className="flex items-center gap-2">
              <Search className="size-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by quote number, customer, email, or status..."
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
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Quote #</th>
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
                      No quotations found
                    </td>
                  </tr>
                ) : (
                  filtered.map((quote) => (
                    <tr key={quote.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {quote.quotation?.quoteNumber}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div>{quote.customer?.customerName}</div>
                        <div className="text-xs text-slate-500">{quote.customer?.email}</div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        ₹{quote.totals?.grandTotal?.toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`inline-block rounded-full px-3 py-1 text-xs font-medium border ${
                            statusColors[quote.status] || 'bg-slate-100 text-slate-800 border-slate-300'
                          }`}
                        >
                          {quote.status || 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {new Date(quote.quotation?.quotationDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewPDF(quote)}
                            className="rounded p-2 hover:bg-slate-100 transition-colors"
                            title="View PDF"
                          >
                            <Eye className="size-4 text-slate-600" />
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(quote)}
                            className="rounded p-2 hover:bg-slate-100 transition-colors"
                            title="Download PDF"
                          >
                            <Download className="size-4 text-slate-600" />
                          </button>
                          <button
                            onClick={() => {
                              setPopup({ type: 'email', quote });
                              setEmailForm({ 
                                recipients: quote.customer?.email || '', 
                                subject: `Quotation ${quote.quotation?.quoteNumber}`,
                                message: ''
                              });
                            }}
                            className="rounded p-2 hover:bg-slate-100 transition-colors"
                            title="Send Email"
                          >
                            <Mail className="size-4 text-slate-600" />
                          </button>
                          <Link
                            to={`/quotations/${quote.id}/edit`}
                            className="rounded p-2 hover:bg-slate-100 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="size-4 text-slate-600" />
                          </Link>
                          <button
                            onClick={() => handleDelete(quote.id, quote.quotation?.quoteNumber)}
                            className="rounded p-2 hover:bg-slate-100 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="size-4 text-red-600" />
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

      {/* Email Modal */}
      {popup.type === 'email' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-lg">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">
                Send Quotation Email
              </h3>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-3 focus:ring-sky-500/10"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Message (optional)
                </label>
                <textarea
                  rows="3"
                  value={emailForm.message}
                  onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-3 focus:ring-sky-500/10"
                  placeholder="Add a custom message..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => setPopup({ type: '', quote: null })}
                className={modalButtonClass}
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
