import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Shield,
  User,
  Pencil,
  Trash2,
  Loader2,
  Inbox,
} from 'lucide-react';
import { getUsers, deleteUser, getUsersSummary } from '../utils/userStorage';

export default function UsersDashboard() {
  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState({ total: 0, admins: 0, standard: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getUsers();
      setUsers(data);
      setSummary(getUsersSummary(data));
    } catch (err) {
      setError(err.message || 'Failed to load users');
      setUsers([]);
      setSummary({ total: 0, admins: 0, standard: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, fullName) => {
    if (
      !window.confirm(`Delete user "${fullName}"? This cannot be undone.`)
    ) {
      return;
    }

    try {
      await deleteUser(id);
      await loadUsers();
    } catch (err) {
      alert('Error deleting user: ' + err.message);
    }
  };

  const filtered = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.username.toLowerCase().includes(term) ||
      (u.employeeId || '').toLowerCase().includes(term) ||
      (u.reportingManager || '').toLowerCase().includes(term) ||
      (u.region || '').toLowerCase().includes(term) ||
      (u.status || '').toLowerCase().includes(term)
    );
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
            <h2 className="text-2xl font-semibold text-slate-800">Users</h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage login profiles stored in users.json
            </p>
          </div>
          <Link
            to="/users/new"
            className="inline-flex items-center gap-1.5 rounded bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white no-underline transition-all hover:bg-sky-600"
          >
            <UserPlus className="size-4" />
            New User
          </Link>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="flex items-center gap-5 rounded-lg bg-white p-5 shadow-sm">
            <Users className="size-10 shrink-0 text-brand" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Total Users
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800">{summary.total}</p>
            </div>
          </div>
          <div className="flex items-center gap-5 rounded-lg bg-white p-5 shadow-sm">
            <Shield className="size-10 shrink-0 text-amber-500" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Admins
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800">{summary.admins}</p>
            </div>
          </div>
          <div className="flex items-center gap-5 rounded-lg bg-white p-5 shadow-sm">
            <User className="size-10 shrink-0 text-sky-500" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Standard Users
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800">{summary.standard}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-5 shadow-sm">
          <input
            type="text"
            placeholder="Search by name, email, or username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-3 focus:ring-sky-500/10"
          />
        </div>

        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          {filtered.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <Inbox className="mx-auto mb-5 size-16 text-slate-400" />
              <p className="mb-5 text-slate-500">
                {users.length === 0
                  ? 'No users yet. Create the first login profile.'
                  : 'No users match your search.'}
              </p>
              {users.length === 0 && (
                <Link
                  to="/users/new"
                  className="inline-block rounded bg-sky-500 px-5 py-2.5 font-semibold text-white no-underline hover:bg-sky-600"
                >
                  Create User Profile
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-100 bg-surface">
                    <th className="px-4 py-4 text-left text-xs font-semibold tracking-wide text-slate-800 uppercase">
                      Name
                    </th>
                    <th className="hidden px-4 py-4 text-left text-xs font-semibold tracking-wide text-slate-800 uppercase md:table-cell">
                      Email
                    </th>
                    <th className="hidden px-4 py-4 text-left text-xs font-semibold tracking-wide text-slate-800 uppercase lg:table-cell">
                      Employee ID
                    </th>
                    <th className="hidden px-4 py-4 text-left text-xs font-semibold tracking-wide text-slate-800 uppercase lg:table-cell">
                      Region
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-semibold tracking-wide text-slate-800 uppercase">
                      Username
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-semibold tracking-wide text-slate-800 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-semibold tracking-wide text-slate-800 uppercase">
                      Role
                    </th>
                    <th className="hidden px-4 py-4 text-left text-xs font-semibold tracking-wide text-slate-800 uppercase lg:table-cell">
                      Phone
                    </th>
                    <th className="px-4 py-4 text-center text-xs font-semibold tracking-wide text-slate-800 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-slate-100 transition-colors hover:bg-slate-50"
                    >
                      <td className="px-4 py-4 text-sm font-semibold text-slate-800">
                        {user.fullName}
                      </td>
                      <td className="hidden px-4 py-4 text-sm text-slate-600 md:table-cell">
                        {user.email}
                      </td>
                      <td className="hidden px-4 py-4 text-sm text-slate-600 lg:table-cell">
                        {user.employeeId || '—'}
                      </td>
                      <td className="hidden px-4 py-4 text-sm text-slate-600 lg:table-cell">
                        {user.region || '—'}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {user.username}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={[
                            'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
                            user.status?.toLowerCase() === 'inactive'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-emerald-100 text-emerald-800',
                          ].join(' ')}
                        >
                          {user.status || 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={[
                            'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
                            user.role?.toLowerCase() === 'admin'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-sky-100 text-sky-800',
                          ].join(' ')}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="hidden px-4 py-4 text-sm text-slate-500 lg:table-cell">
                        {user.phone || '—'}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center gap-2">
                          <Link
                            to={`/users/${user.id}/edit`}
                            className="rounded p-1.5 text-slate-600 transition-all hover:bg-sky-50 hover:text-sky-600"
                            title="Edit"
                          >
                            <Pencil className="size-4" />
                          </Link>
                          <button
                            type="button"
                            className="rounded p-1.5 text-slate-600 transition-all hover:bg-red-50 hover:text-red-500"
                            title="Delete"
                            onClick={() => handleDelete(user.id, user.fullName)}
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

          {filtered.length > 0 && (
            <div className="rounded-b-lg bg-surface px-5 py-4 text-right text-xs text-slate-500">
              Showing {filtered.length} of {users.length} users
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
