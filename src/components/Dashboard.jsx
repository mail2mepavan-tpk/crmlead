import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Calendar,
  TrendingUp,
  Download,
  Upload,
  Plus,
  Inbox,
  Eye,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  getEnquiries,
  deleteEnquiry,
  exportEnquiries,
  importEnquiries,
  getEnquiriesSummary,
} from '../utils/enquiryStorage';
import {
  getCustomerName,
  enquiryMatchesSearch,
  formatEnquiryDetails,
} from '../utils/enquiryFields';

const inputClass =
  'w-full rounded border border-slate-300 px-3 py-2.5 text-sm transition-colors focus:border-sky-500 focus:outline-none focus:ring-3 focus:ring-sky-500/10';

export default function Dashboard() {
  const [enquiries, setEnquiries] = useState([]);
  const [filteredEnquiries, setFilteredEnquiries] = useState([]);
  const [summary, setSummary] = useState({ total: 0, today: 0, thisMonth: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadEnquiries();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [enquiries, searchTerm, filterDate, sortBy]);

  const loadEnquiries = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getEnquiries();
      setEnquiries(data);
      setSummary(getEnquiriesSummary(data));
    } catch (err) {
      setError(err.message || 'Failed to load enquiries');
      setEnquiries([]);
      setSummary({ total: 0, today: 0, thisMonth: 0 });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...enquiries];

    if (searchTerm) {
      filtered = filtered.filter((e) => enquiryMatchesSearch(e, searchTerm));
    }

    if (filterDate) {
      filtered = filtered.filter((e) => e.date === filterDate);
    }

    if (sortBy === 'newest') {
      filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (sortBy === 'oldest') {
      filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (sortBy === 'name') {
      filtered.sort((a, b) =>
        getCustomerName(a).localeCompare(getCustomerName(b))
      );
    }

    setFilteredEnquiries(filtered);
  };

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this enquiry? This action cannot be undone.'
      )
    ) {
      return;
    }

    try {
      await deleteEnquiry(id);
      await loadEnquiries();
    } catch (err) {
      alert('Error deleting enquiry: ' + err.message);
    }
  };

  const handleExport = async () => {
    try {
      await exportEnquiries();
    } catch (err) {
      alert('Error exporting enquiries: ' + err.message);
    }
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }

    importEnquiries(file)
      .then(() => {
        alert('Enquiries imported successfully!');
        loadEnquiries();
      })
      .catch((err) => {
        alert('Error importing enquiries: ' + err.message);
      })
      .finally(() => {
        e.target.value = '';
      });
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
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
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}. Restart the dev server with{' '}
            <code className="rounded bg-red-100 px-1">npm run dev</code>.
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center gap-5 rounded-lg bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <BarChart3 className="size-10 shrink-0 text-brand" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Total Enquiries
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800">
                {summary.total}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5 rounded-lg bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <Calendar className="size-10 shrink-0 text-sky-500" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Today
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800">
                {summary.today}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5 rounded-lg bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <TrendingUp className="size-10 shrink-0 text-emerald-500" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                This Month
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800">
                {summary.thisMonth}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 items-end gap-5 rounded-lg bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700">Search</label>
            <input
              type="text"
              placeholder="Search customer, region, contact, POC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700">
              Filter by Date
            </label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={inputClass}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">By Name (A-Z)</option>
            </select>
          </div>

          {filterDate && (
            <button
              type="button"
              onClick={() => setFilterDate('')}
              className="rounded border border-slate-300 bg-slate-100 px-3 py-2 text-xs transition-colors hover:bg-slate-300 hover:text-white"
            >
              Clear Filters
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Link
            to="/intake"
            className="inline-flex items-center gap-1.5 rounded bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white no-underline transition-all hover:-translate-y-0.5 hover:bg-sky-600 hover:shadow-md"
          >
            <Plus className="size-4" />
            New Enquiry
          </Link>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-emerald-700"
          >
            <Download className="size-4" />
            Export
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-emerald-700">
            <Upload className="size-4" />
            Import
            <input type="file" accept=".json" onChange={handleImport} />
          </label>
        </div>

        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          {filteredEnquiries.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <Inbox className="mx-auto mb-5 size-16 text-slate-400" />
              <p className="mb-5 text-slate-500">
                {enquiries.length === 0
                  ? 'No enquiries yet. Create your first enquiry!'
                  : 'No enquiries match your filters.'}
              </p>
              {enquiries.length === 0 && (
                <Link
                  to="/intake"
                  className="inline-block rounded bg-sky-500 px-5 py-2.5 font-semibold text-white no-underline transition-all hover:-translate-y-0.5 hover:bg-sky-600"
                >
                  Create New Enquiry
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-100 bg-surface">
                    <th className="hidden px-4 py-4 text-left text-xs font-semibold tracking-wide text-slate-800 uppercase sm:table-cell">
                      Enquiry No
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-semibold tracking-wide text-slate-800 uppercase">
                      Customer
                    </th>
                    <th className="hidden px-4 py-4 text-left text-xs font-semibold tracking-wide text-slate-800 uppercase lg:table-cell">
                      Region
                    </th>
                    <th className="hidden px-4 py-4 text-left text-xs font-semibold tracking-wide text-slate-800 uppercase md:table-cell">
                      Sales POC
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-semibold tracking-wide text-slate-800 uppercase">
                      Contact
                    </th>
                    <th className="hidden px-4 py-4 text-left text-xs font-semibold tracking-wide text-slate-800 uppercase xl:table-cell">
                      Email
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-semibold tracking-wide text-slate-800 uppercase">
                      Date
                    </th>
                    <th className="px-4 py-4 text-center text-xs font-semibold tracking-wide text-slate-800 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEnquiries.map((enquiry) => (
                    <tr
                      key={enquiry.id}
                      className="border-b border-slate-100 transition-colors hover:bg-slate-50"
                    >
                      <td className="hidden px-4 py-4 text-xs font-mono text-slate-500 sm:table-cell">
                        {enquiry.enquiryNo || '—'}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-800">
                        {getCustomerName(enquiry)}
                      </td>
                      <td className="hidden px-4 py-4 text-sm text-slate-600 lg:table-cell">
                        {enquiry.region || '—'}
                      </td>
                      <td className="hidden px-4 py-4 text-sm text-slate-600 md:table-cell">
                        {enquiry.salesPoc || '—'}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        <div>{enquiry.contactPerson || '—'}</div>
                        {enquiry.contactMobile && (
                          <div className="text-xs text-slate-500">
                            {enquiry.contactMobile}
                          </div>
                        )}
                      </td>
                      <td className="hidden max-w-[180px] truncate px-4 py-4 text-sm text-slate-500 xl:table-cell">
                        {enquiry.contactEmail || '—'}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {formatDate(enquiry.date)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            className="rounded p-1.5 text-slate-600 transition-all hover:scale-110 hover:bg-slate-100"
                            title="View Details"
                            onClick={() => alert(formatEnquiryDetails(enquiry))}
                          >
                            <Eye className="size-4" />
                          </button>
                          <Link
                            to={`/intake/${enquiry.id}`}
                            className="rounded p-1.5 text-slate-600 transition-all hover:scale-110 hover:bg-sky-50 hover:text-sky-600"
                            title="Edit"
                          >
                            <Pencil className="size-4" />
                          </Link>
                          <button
                            type="button"
                            className="rounded p-1.5 text-slate-600 transition-all hover:scale-110 hover:bg-red-50 hover:text-red-500"
                            title="Delete"
                            onClick={() => handleDelete(enquiry.id)}
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

          {filteredEnquiries.length > 0 && (
            <div className="rounded-b-lg bg-surface px-5 py-4 text-right text-xs text-slate-500">
              Showing {filteredEnquiries.length} of {enquiries.length} enquiries
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
