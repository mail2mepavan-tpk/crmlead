import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  Inbox,
} from 'lucide-react';
import {
  getSalesLeads,
  deleteSalesLead,
  getSalesLeadsSummary,
} from '../utils/salesLeadStorage';

export default function SalesLeadsDashboard() {
  const [leads, setLeads] = useState([]);
  const [summary, setSummary] = useState({ total: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadLeads();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getSalesLeads();
      var filteredData = data;
      if (JSON.parse(sessionStorage.getItem('crm_current_user'))?.role?.toLowerCase() === 'executive') {
       filteredData = data.filter((lead) => lead.createdBy.toLowerCase() === JSON.parse(sessionStorage.getItem('crm_current_user')).fullName.toLowerCase());
      }
      setLeads(filteredData);
      setSummary(getSalesLeadsSummary(filteredData));
      setCurrentPage(1);
    } catch (err) {
      setError(err.message || 'Failed to load sales leads');
      setLeads([]);
      setSummary({ total: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete sales lead "${title}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteSalesLead(id);
      await loadLeads();
    } catch (err) {
      alert('Error deleting sales lead: ' + err.message);
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return [
      lead.title,
      lead.salesPoc,
      lead.leadContact,
      lead.companyName,
      lead.leadRegion,
      lead.leadStatus,
      lead.leadRating,
      lead.leadSource,
    ]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(term));
  });

  const statusChartData = Object.entries(
    filteredLeads.reduce((acc, lead) => {
      const status = lead.leadStatus || 'New';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const maxStatusCount = Math.max(1, ...statusChartData.map(([, count]) => count));
  const itemsPerPage = 5;
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const paginatedLeads = filteredLeads.slice(startIndex, startIndex + itemsPerPage);

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
            <h2 className="text-2xl font-semibold text-slate-800">Sales Leads</h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage sales leads stored in data/salesLeads.json.
            </p>
          </div>
          <Link
            to="/sales-leads/new"
            className="inline-flex items-center gap-2 rounded bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white no-underline transition-all hover:bg-sky-600"
          >
            <Plus className="size-4" />
            New Lead
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="flex items-center gap-4 rounded-lg bg-white p-5 shadow-sm">
            <Layers className="size-10 shrink-0 text-brand" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Total Leads
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800">
                {summary.total}
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Lead Status Statistics</h3>
              <p className="text-sm text-slate-500">Distribution of current lead statuses.</p>
            </div>
            {statusChartData.length === 0 ? (
              <p className="text-sm text-slate-500">No lead data available yet.</p>
            ) : (
              <div className="space-y-3">
                {statusChartData.map(([status, count]) => {
                  const width = `${Math.max(8, (count / maxStatusCount) * 100)}%`;
                  return (
                    <div key={status} className="space-y-1">
                      <div className="flex items-center justify-between text-sm text-slate-700">
                        <span className="font-medium">{status}</span>
                        <span>{count}</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100">
                        <div className="h-2.5 rounded-full bg-sky-500" style={{ width }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <Search className="size-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search leads by title, contact, company, status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent text-sm text-slate-800 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          {filteredLeads.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <Inbox className="mx-auto mb-5 size-16 text-slate-400" />
              <p className="mb-5 text-slate-500">
                {leads.length === 0
                  ? 'No sales leads yet. Create the first lead.'
                  : 'No leads match your search.'}
              </p>
              {leads.length === 0 && (
                <Link
                  to="/sales-leads/new"
                  className="inline-block rounded bg-sky-500 px-5 py-2.5 font-semibold text-white no-underline hover:bg-sky-600"
                >
                  Add First Lead
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-100 bg-surface text-left uppercase text-[11px] tracking-[0.18em] text-slate-500">
                    <th className="px-4 py-4">Title</th>
                    <th className="px-4 py-4">Company</th>
                    <th className="px-4 py-4">Contact</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Region</th>
                    <th className="px-4 py-4">Received</th>
                    <th className="px-4 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLeads.map((lead) => (
                    <tr key={lead.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                      <td className="px-4 py-4 font-semibold text-slate-900">{lead.title}</td>
                      <td className="px-4 py-4 text-slate-700">{lead.companyName || '—'}</td>
                      <td className="px-4 py-4 text-slate-700">{lead.leadContact || '—'}</td>
                      <td className="px-4 py-4 text-slate-700">{lead.leadStatus || 'New'}</td>
                      <td className="px-4 py-4 text-slate-700">{lead.leadRegion || '—'}</td>
                      <td className="px-4 py-4 text-slate-700">{lead.receivedDate || '—'}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center gap-2">
                          {lead.leadStatus != 'Converted' ? (
                            <Link
                              to={`/sales-leads/${lead.id}/edit`}
                              className="rounded border border-slate-200 bg-white p-2 text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50"
                              title="Edit lead"
                            >
                            <Pencil className="size-4" />
                          </Link>
                          ) : (
                             <span style={{ color: 'red' }} title="No Edit lead">
                              Locked
                            </span>
                          ) }
                          <button
                            type="button"
                            onClick={() => handleDelete(lead.id, lead.title)}
                            className="rounded border border-red-200 bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100"
                            title="Delete lead"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filteredLeads.length > itemsPerPage && (
            <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredLeads.length)} of {filteredLeads.length} leads
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safePage === 1}
                  className="rounded border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safePage === totalPages}
                  className="rounded border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
