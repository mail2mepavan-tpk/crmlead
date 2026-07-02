import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  ListChecks,
  Users,
  FileText,
  Package,
} from 'lucide-react';
import {
  getAccounts,
  deleteAccount,
  getAccountsSummary,
} from '../utils/accountStorage';

const modalButtonClass =
  'rounded border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50';

export default function AccountsDashboard() {
  const [accounts, setAccounts] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0, pending: 0, underReview: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [popup, setPopup] = useState({ type: '', account: null });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getAccounts();
      setAccounts(data);
      setSummary(getAccountsSummary(data));
    } catch (err) {
      setError(err.message || 'Failed to load accounts');
      setAccounts([]);
      setSummary({ total: 0, active: 0, inactive: 0, pending: 0, underReview: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete account "${name}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteAccount(id);
      await loadAccounts();
    } catch (err) {
      alert('Error deleting account: ' + err.message);
    }
  };

  const filtered = accounts.filter((account) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return [
      account.CompanyName,
      account.Owner,
      account.Status,
      account.City,
      account.State,
      account.Country,
    ]
      .filter(Boolean)
      .some((field) => field.toLowerCase().includes(term));
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
            <h2 className="text-2xl font-semibold text-slate-800">Accounts</h2>
            <p className="mt-1 text-sm text-slate-500">
              Create and manage Account records stored in data/accounts.json.
            </p>
          </div>
          <Link
            to="/accounts/new"
            className="inline-flex items-center gap-2 rounded bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white no-underline transition-all hover:bg-sky-600"
          >
            <Plus className="size-4" />
            New Account
          </Link>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-4">
          <div className="flex items-center gap-4 rounded-lg bg-white p-5 shadow-sm">
            <Building2 className="size-10 shrink-0 text-brand" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Accounts
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800">{summary.total}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-lg bg-white p-5 shadow-sm">
            <Users className="size-10 shrink-0 text-emerald-500" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Active
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800">{summary.active}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-lg bg-white p-5 shadow-sm">
            <FileText className="size-10 shrink-0 text-amber-500" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Pending / Review
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800">{summary.pending + summary.underReview}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-lg bg-white p-5 shadow-sm">
            <ListChecks className="size-10 shrink-0 text-slate-600" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Inactive
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800">{summary.inactive}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <Search className="size-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search company, owner, status, city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent text-sm text-slate-800 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          {filtered.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <Package className="mx-auto mb-5 size-16 text-slate-400" />
              <p className="mb-5 text-slate-500">
                {accounts.length === 0
                  ? 'No accounts yet. Create a new account record.'
                  : 'No accounts match your search.'}
              </p>
              {accounts.length === 0 && (
                <Link
                  to="/accounts/new"
                  className="inline-block rounded bg-sky-500 px-5 py-2.5 font-semibold text-white no-underline hover:bg-sky-600"
                >
                  Add First Account
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-100 bg-surface text-left uppercase text-[11px] tracking-[0.18em] text-slate-500">
                    <th className="px-4 py-4">Company</th>
                    <th className="px-4 py-4">Location</th>
                    <th className="px-4 py-4">Owner</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Health</th>
                    <th className="px-4 py-4">Created</th>
                    <th className="px-4 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((account) => (
                    <tr
                      key={account.id}
                      className="border-b border-slate-100 transition-colors hover:bg-slate-50"
                    >
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-900">{account.CompanyName}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {account.Industry || 'Industry not set'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div>{account.City || '—'}, {account.State || '—'}</div>
                        <div className="text-xs text-slate-500">{account.Country || '—'}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">{account.Owner || '—'}</td>
                      <td className="px-4 py-4">
                        <span
                          className={[
                            'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase',
                            account.Status === 'Active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : account.Status === 'In-Active'
                              ? 'bg-slate-100 text-slate-800'
                              : account.Status === 'Pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-violet-100 text-violet-800',
                          ].join(' ')}
                        >
                          {account.Status || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={[
                            'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase',
                            account.Health === 'Green'
                              ? 'bg-emerald-100 text-emerald-800'
                              : account.h2ealth === 'Yellow'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800',
                          ].join(' ')}
                        >
                          {account.Health || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-500">
                        <div>{account.CreatedDate ? new Date(account.CreatedDate).toLocaleDateString() : '—'}</div>
                        <div className="text-xs">{account.CreatedBy || 'System'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <Link
                            to={`/accounts/${account.Id}/edit`}
                            className="rounded border border-slate-200 bg-white p-2 text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50"
                            title="Edit account"
                          >
                            <Pencil className="size-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(account.Id, account.CompanyName)}
                            className="rounded border border-red-200 bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100"
                            title="Delete account"
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
        </div>
      </div>

      {popup.account && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-10">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {popup.type === 'leads' ? 'Leads' : popup.type === 'contacts' ? 'Contacts' : 'Deals'}
                </p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">
                  {popup.account.companyName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPopup({ type: '', account: null })}
                className="rounded-full border border-slate-200 bg-slate-50 p-2 text-slate-700 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-4 text-sm text-slate-700">
              <p>
                {popup.type === 'leads'
                  ? 'Associated lead data is shown here for this account. Add or connect leads from your CRM system.'
                  : popup.type === 'contacts'
                  ? 'Associated contacts are displayed here. Use this section to review contact assignments.'
                  : 'Associated deals or sales orders are shown here for the account.'}
              </p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                {popup.account[popup.type]?.length > 0 ? (
                  <ul className="space-y-2">
                    {popup.account[popup.type].map((item, index) => (
                      <li key={index} className="rounded border border-slate-200 bg-white px-4 py-3">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500">No {popup.type} associated yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
