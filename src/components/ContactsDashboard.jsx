import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  Inbox,
  MessageCircle,
} from 'lucide-react';
import {
  getContacts,
  deleteContact,
  getContactsSummary,
} from '../utils/contactStorage';

const modalButtonClass =
  'rounded border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50';

export default function ContactsDashboard() {
  const [contacts, setContacts] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [popup, setPopup] = useState({ type: '', contact: null });

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getContacts();
      setContacts(data);
      setSummary(getContactsSummary(data));
    } catch (err) {
      setError(err.message || 'Failed to load contacts');
      setContacts([]);
      setSummary({ total: 0, active: 0, inactive: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, firstName, lastName) => {
    if (
      !window.confirm(`Delete contact "${firstName} ${lastName}"? This cannot be undone.`)
    ) {
      return;
    }

    try {
      await deleteContact(id);
      await loadContacts();
    } catch (err) {
      alert('Error deleting contact: ' + err.message);
    }
  };

  const filtered = contacts.filter((contact) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return [
      contact.salutation,
      contact.firstName,
      contact.lastName,
      contact.email,
      contact.mobile,
      contact.status,
      contact.department,
      contact.designation,
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
            <h2 className="text-2xl font-semibold text-slate-800">Contacts</h2>
            <p className="mt-1 text-sm text-slate-500">
              Create and manage contact records stored in data/contacts.json.
            </p>
          </div>
          <Link
            to="/contacts/new"
            className="inline-flex items-center gap-2 rounded bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white no-underline transition-all hover:bg-sky-600"
          >
            <Plus className="size-4" />
            New Contact
          </Link>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="flex items-center gap-4 rounded-lg bg-white p-5 shadow-sm">
            <User className="size-10 shrink-0 text-brand" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Contacts
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800">{summary.total}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-lg bg-white p-5 shadow-sm">
            <MessageCircle className="size-10 shrink-0 text-emerald-500" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Active
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800">{summary.active}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-lg bg-white p-5 shadow-sm">
            <Inbox className="size-10 shrink-0 text-amber-500" />
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
                placeholder="Search by name, email, mobile, status..."
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
                {contacts.length === 0
                  ? 'No contacts yet. Create a new contact record.'
                  : 'No contacts match your search.'}
              </p>
              {contacts.length === 0 && (
                <Link
                  to="/contacts/new"
                  className="inline-block rounded bg-sky-500 px-5 py-2.5 font-semibold text-white no-underline hover:bg-sky-600"
                >
                  Add First Contact
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-100 bg-surface text-left uppercase text-[11px] tracking-[0.18em] text-slate-500">
                    <th className="px-4 py-4">Name</th>
                    <th className="px-4 py-4">Mobile</th>
                    <th className="px-4 py-4">Email</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Company</th>
                    <th className="px-4 py-4">Created</th>
                    <th className="px-4 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((contact) => (
                    <tr
                      key={contact.id}
                      className="border-b border-slate-100 transition-colors hover:bg-slate-50"
                    >
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-900">
                          {contact.salutation ? `${contact.salutation} ` : ''}
                          {contact.firstName} {contact.lastName}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {contact.designation || 'No designation'}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">{contact.mobile || '—'}</td>
                      <td className="px-4 py-4 text-slate-700">{contact.email || '—'}</td>
                      <td className="px-4 py-4">
                        <span
                          className={[
                            'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase',
                            contact.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-800',
                          ].join(' ')}
                        >
                          {contact.status || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {contact.department || '—'}
                      </td>
                      <td className="px-4 py-4 text-slate-500">
                        {contact.createdDate ? new Date(contact.createdDate).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <Link
                            to={`/contacts/${contact.id}/edit`}
                            className="rounded border border-slate-200 bg-white p-2 text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50"
                            title="Edit contact"
                          >
                            <Pencil className="size-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(contact.id, contact.firstName, contact.lastName)}
                            className="rounded border border-red-200 bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100"
                            title="Delete contact"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2">
                          <button
                            type="button"
                            className={modalButtonClass}
                            onClick={() => setPopup({ type: 'leads', contact })}
                          >
                            Leads
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

      {popup.contact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-10">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Leads
                </p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">
                  {popup.contact.firstName} {popup.contact.lastName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPopup({ type: '', contact: null })}
                className="rounded-full border border-slate-200 bg-slate-50 p-2 text-slate-700 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-4 text-sm text-slate-700">
              <p>
                Associated leads for this contact are shown here. This popup is a placeholder for the lead associations.
              </p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                {popup.contact.leads?.length > 0 ? (
                  <ul className="space-y-2">
                    {popup.contact.leads.map((item, index) => (
                      <li key={index} className="rounded border border-slate-200 bg-white px-4 py-3">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500">No leads associated yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
