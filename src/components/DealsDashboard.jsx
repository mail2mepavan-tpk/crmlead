import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Plus, Search, Loader2, FileText, Trash2, Inbox, X, Pencil } from 'lucide-react';
import { getDeals, deleteDeal, getDealsSummary } from '../utils/dealStorage';
import { getQuotes } from '../utils/quoteStorage';

export default function DealsDashboard() {
  const [deals, setDeals] = useState([]);
  const [summary, setSummary] = useState({ total: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [quoteDialog, setQuoteDialog] = useState({
    open: false,
    deal: null,
    quotes: [],
    loading: false,
    error: '',
  });

  useEffect(() => {
    loadDeals();
  }, []);

  const loadDeals = async () => {
    try {
      setLoading(true);
      const data = await getDeals();
      setDeals(data);
      setSummary(getDealsSummary(data));
    } catch (err) {
      setDeals([]);
      setSummary({ total: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete deal "${name}"? This cannot be undone.`)) return;
    try {
      await deleteDeal(id);
      await loadDeals();
    } catch (err) {
      alert('Error deleting deal: ' + (err.message || err));
    }
  };

  const openQuoteDialog = async (deal) => {
    setQuoteDialog({ open: true, deal, quotes: [], loading: true, error: '' });

    try {
      const allQuotes = await getQuotes();
      const associatedQuotes = allQuotes.filter((quote) => {
        if (quote.dealid === deal.id) return true;
        const reference = quote.quotation?.reference || '';
        const normalizedReference = String(reference).toLowerCase().trim();
        return (
          normalizedReference === String(deal.id).toLowerCase().trim() ||
          normalizedReference === String(deal.dealName).toLowerCase().trim()
        );
      });
      setQuoteDialog({ open: true, deal, quotes: associatedQuotes, loading: false, error: '' });
    } catch (err) {
      setQuoteDialog({
        open: true,
        deal,
        quotes: [],
        loading: false,
        error: err.message || 'Failed to load quotes',
      });
    }
  };

  const closeQuoteDialog = () => {
    setQuoteDialog({ open: false, deal: null, quotes: [], loading: false, error: '' });
  };

  const filtered = deals.filter((d) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return [d.dealName, d.account, d.primaryContact, d.dealStage, d.region]
      .filter(Boolean)
      .some((v) => v.toLowerCase().includes(term));
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
            <h2 className="text-2xl font-semibold text-slate-800">Deals</h2>
            <p className="mt-1 text-sm text-slate-500">Manage deals stored in data/deals.json.</p>
          </div>
          <Link to="/deals/new" className="inline-flex items-center gap-2 rounded bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white no-underline hover:bg-sky-600">
            <Plus className="size-4" />
            New Deal
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="flex items-center gap-4 rounded-lg bg-white p-5 shadow-sm">
            <Layers className="size-10 shrink-0 text-brand" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Total Deals</p>
              <p className="mt-2 text-3xl font-bold text-slate-800">{summary.total}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <Search className="size-4 text-slate-400" />
            <input type="text" placeholder="Search deals by name, account, contact, stage..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-transparent text-sm text-slate-800 outline-none" />
          </div>
        </div>

        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          {filtered.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <Inbox className="mx-auto mb-5 size-16 text-slate-400" />
              <p className="mb-5 text-slate-500">{deals.length === 0 ? 'No deals yet. Create the first deal.' : 'No deals match your search.'}</p>
              {deals.length === 0 && (
                <Link to="/deals/new" className="inline-block rounded bg-sky-500 px-5 py-2.5 font-semibold text-white no-underline hover:bg-sky-600">Add First Deal</Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-100 bg-surface text-left uppercase text-[11px] tracking-[0.18em] text-slate-500">
                    <th className="px-4 py-4">Deal</th>
                    <th className="px-4 py-4">Account</th>
                    <th className="px-4 py-4">Amount</th>
                    <th className="px-4 py-4">Stage</th>
                    <th className="px-4 py-4">Close Date</th>
                    <th className="px-4 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => 
                  ( d.dealStage?.toLowerCase() === 'won' ? 
                  (
                  <tr key={d.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50 bg-green-50">
                      <td className="px-4 py-4 font-semibold text-slate-900">{d.dealName}</td>
                      <td className="px-4 py-4 text-slate-700">{d.account || '—'}</td>
                      <td className="px-4 py-4 text-slate-700">{d.dealAmount || '—'}</td>
                      <td className="px-4 py-4 text-slate-700">{d.dealStage || 'New'}</td>
                      <td className="px-4 py-4 text-slate-700">{d.expectedClosureDate || '—'}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center gap-2">
                          <button type="button" onClick={() => openQuoteDialog(d)} className="rounded border border-slate-200 bg-white px-3 py-2 text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50" title="View associated quotes">
                            <FileText className="size-4" />
                          </button>
                          <Link
                              to={`/quotations/new/deal/${d.id}`}
                              className="rounded border border-slate-200 bg-white px-3 py-2 text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50"
                              title="Create quote">
                              <Plus className="size-4" />
                          </Link>
                          <button type="button" onClick={() => handleDelete(d.id, d.dealName)} className="rounded border border-red-200 bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100" title="Delete deal"><Trash2 className="size-4" /></button>
                        </div>
                      </td>
                  </tr>
                  ) : 
                    (
                      <tr key={d.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                      <td className="px-4 py-4 font-semibold text-slate-900">{d.dealName}</td>
                      <td className="px-4 py-4 text-slate-700">{d.account || '—'}</td>
                      <td className="px-4 py-4 text-slate-700">{d.dealAmount || '—'}</td>
                      <td className="px-4 py-4 text-slate-700">{d.dealStage || 'New'}</td>
                      <td className="px-4 py-4 text-slate-700">{d.expectedClosureDate || '—'}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center gap-2">
                          <Link
                              to={`/deals/${d.id}/edit`}
                              className="rounded border border-red-200 bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100"
                              title="Edit deal"><Pencil className="size-4" />
                          </Link>
                           <button type="button" onClick={() => openQuoteDialog(d)} className="rounded border border-slate-200 bg-white px-3 py-2 text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50" title="View associated quotes">
                            <FileText className="size-4" />
                          </button>
                          <Link
                              to={`/quotations/new/deal/${d.id}`}
                              className="rounded border border-slate-200 bg-white px-3 py-2 text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50"
                              title="Create quote">
                              <Plus className="size-4" />
                          </Link>
                          <button type="button" onClick={() => handleDelete(d.id, d.dealName)} className="rounded border border-red-200 bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100" 
                          title="Delete deal"><Trash2 className="size-4" /></button>
                        </div>
                      </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {quoteDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-lg">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Quotes for {quoteDialog.deal?.dealName || 'this deal'}</h3>
                <p className="text-sm text-slate-500">Listing quotes associated with the selected deal.</p>
              </div>
              <button type="button" onClick={closeQuoteDialog} className="rounded border border-slate-200 bg-slate-50 p-2 text-slate-600 transition hover:bg-slate-100" title="Close">
                <X className="size-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-6">
              {quoteDialog.loading ? (
                <div className="flex min-h-[200px] items-center justify-center text-slate-500">
                  <Loader2 className="size-8 animate-spin text-brand" />
                </div>
              ) : quoteDialog.error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {quoteDialog.error}
                </div>
              ) : quoteDialog.quotes.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-600">
                  No quotes are associated with this deal yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                        <th className="px-4 py-3">Quote #</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quoteDialog.quotes.map((quote) => (
                        <tr key={quote.id} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-slate-900">{quote.quotation?.quoteNumber || '—'}</td>
                          <td className="px-4 py-3 text-slate-700">{quote.customer?.customerName || '—'}</td>
                          <td className="px-4 py-3 text-slate-700">₹{quote.totals?.grandTotal?.toLocaleString('en-IN') || '—'}</td>
                          <td className="px-4 py-3 text-slate-700">{quote.status || 'Pending'}</td>
                          <td className="px-4 py-3 text-slate-700">{quote.quotation?.quotationDate ? new Date(quote.quotation.quotationDate).toLocaleDateString('en-IN') : '—'}</td>
                          <td className="px-4 py-3">
                            <Link to={`/quotations/${quote.id}/edit`} className="inline-flex items-center justify-center rounded border border-slate-200 bg-white px-3 py-2 text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50" title="Edit quote">
                              Edit
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="border-t border-slate-200 px-6 py-4 text-right">
              <button type="button" onClick={closeQuoteDialog} className="rounded bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
