import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const fieldClass =
  'w-full rounded border border-slate-300 px-3 py-3 text-sm transition-colors focus:border-sky-500 focus:outline-none focus:ring-3 focus:ring-sky-500/10';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.username, form.password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-900 via-header to-brand-dark px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-slate-700/50 bg-white p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-linear-to-br from-brand to-accent shadow-lg">
            <span className="text-lg font-bold text-white">S</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Satvian SalesHub</h2>
          <p className="text-xs font-medium tracking-wider text-nav-muted uppercase">
            Sales & Marketing
          </p>
        </div>
        <p className="mb-6 text-center text-sm text-slate-500">
          Sign in to your enterprise workspace
        </p>

        {error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="username" className="text-sm font-semibold text-slate-800">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className={fieldClass}
              placeholder="Enter username"
              autoComplete="username"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm font-semibold text-slate-800">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className={fieldClass}
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-linear-to-r from-brand to-brand-light px-4 py-3 text-base font-semibold text-white shadow-md transition-opacity hover:opacity-95 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <LogIn className="size-5" />
            )}
            Sign In
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Contact an administrator to request a new account.
        </p>
      </div>
    </div>
  );
}
