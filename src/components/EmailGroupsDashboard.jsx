import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Plus, Search, Loader2, Pencil, Trash2, Inbox } from 'lucide-react';
import { getEmailGroups, deleteEmailGroup, getEmailGroupsSummary } from '../utils/emailGroupStorage';

export default function EmailGroupsDashboard() {
  const [groups, setGroups] = useState([]);
  const [summary, setSummary] = useState({ total: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getEmailGroups();
      setGroups(data);
      setSummary(getEmailGroupsSummary(data));
    } catch (err) {
      setError(err.message || 'Failed to load email groups');
      setGroups([]);
      setSummary({ total: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete email group "${name}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteEmailGroup(id);
      await loadGroups();
    } catch (err) {
      alert('Error deleting email group: ' + err.message);
    }
  };

  const filtered = groups.filter((group) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return [group.name, group.emailIds, group.createdBy, group.updatedBy]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(term));
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
            <h2 className="text-2xl font-semibold text-slate-800">Email Groups</h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage email group entries stored in data/emailGroups.json.
            </p>
          </div>
          <Link
            to="/email-groups/new"
            className="inline-flex items-center gap-2 rounded bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white no-underline transition-all hover:bg-sky-600"
          >
            <Plus className="size-4" />
            New Group
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="flex items-center gap-4 rounded-lg bg-white p-5 shadow-sm">
            <Mail className="size-10 shrink-0 text-brand" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Total Groups</p>
              <p className="mt-2 text-3xl font-bold text-slate-800">{summary.total}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <Search className="size-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by group name or emails..."
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
              <Inbox className="mx-auto mb-5 size-16 text-slate-400" />
              <p className="mb-5 text-slate-500">
                {groups.length === 0
                  ? 'No email groups yet. Create the first group.'
                  : 'No groups match your search.'}
              </p>
              {groups.length === 0 && (
                <Link
                  to="/email-groups/new"
                  className="inline-block rounded bg-sky-500 px-5 py-2.5 font-semibold text-white no-underline hover:bg-sky-600"
                >
                  Add First Group
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-100 bg-surface text-left uppercase text-[11px] tracking-[0.18em] text-slate-500">
                    <th className="px-4 py-4">Group Name</th>
                    <th className="px-4 py-4">Emails</th>
                    <th className="px-4 py-4">Created</th>
                    <th className="px-4 py-4">Updated</th>
                    <th className="px-4 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((group) => (
                    <tr key={group.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                      <td className="px-4 py-4 font-semibold text-slate-900">{group.name}</td>
                      <td className="px-4 py-4 text-slate-700">{group.emailIds || '—'}</td>
                      <td className="px-4 py-4 text-slate-500">
                        <div>{group.createdDate ? new Date(group.createdDate).toLocaleDateString() : '—'}</div>
                        <div className="text-xs">{group.createdBy || 'System'}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-500">
                        <div>{group.updatedDate ? new Date(group.updatedDate).toLocaleDateString() : '—'}</div>
                        <div className="text-xs">{group.updatedBy || 'System'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center gap-2">
                          <Link
                            to={`/email-groups/${group.id}/edit`}
                            className="rounded border border-slate-200 bg-white p-2 text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50"
                            title="Edit group"
                          >
                            <Pencil className="size-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(group.id, group.name)}
                            className="rounded border border-red-200 bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100"
                            title="Delete group"
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
    </div>
  );
}
