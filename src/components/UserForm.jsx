import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { createUser, updateUser, getUserById, getUsers } from '../utils/userStorage';
import { useAuth } from '../context/AuthContext';

const fieldClass = (hasError) =>
  [
    'w-full rounded border px-3 py-3 text-sm transition-colors focus:outline-none focus:ring-3',
    hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10'
      : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500/10',
  ].join(' ');

const emptyForm = () => ({
  fullName: '',
  email: '',
  username: '',
  employeeId: '',
  reportingManager: '',
  region: '',
  status: 'Active',
  password: '',
  confirmPassword: '',
  role: 'Executive',
  phone: '',
});

export default function UserForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { currentUser, isAdmin, updateSessionUser } = useAuth();
  const isProfile = location.pathname === '/profile';
  const editId = isProfile ? currentUser?.id : id;
  const isEditing = Boolean(editId);

  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(isEditing && Boolean(editId));
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [managers, setManagers] = useState([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const users = await getUsers();
        if (!cancelled) {
          const managerUsers = Array.isArray(users)
            ? users.filter((user) => String(user.role || '').toLowerCase() === 'manager')
            : [];
          setManagers(managerUsers);
        }
      } catch {
        if (!cancelled) {
          setManagers([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setLoadError('');
        const user = await getUserById(editId);
        if (!cancelled) {
          setFormData({
            fullName: user.fullName,
            email: user.email,
            username: user.username,
            employeeId: user.employeeId || '',
            reportingManager: user.reportingManager || '',
            region: user.region || '',
            status: user.status || 'Active',
            password: '',
            confirmPassword: '',
            role: user.role,
            phone: user.phone || '',
          });
        }
      } catch {
        if (!cancelled) {
          setLoadError('Could not load user profile.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editId, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Enter a valid email';
    }
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }
    if (!isEditing && !formData.password.trim()) {
      newErrors.password = 'Password is required';
    }
    if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (
      formData.password &&
      formData.password !== formData.confirmPassword
    ) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (
      !isEditing &&
      formData.password &&
      !formData.confirmPassword
    ) {
      newErrors.confirmPassword = 'Please confirm your password';
    }
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload = {
      fullName: formData.fullName,
      email: formData.email,
      username: formData.username,
      employeeId: formData.employeeId,
      reportingManager: formData.reportingManager,
      region: formData.region,
      status: formData.status,
      role: formData.role,
      phone: formData.phone,
    };
    if (formData.password) {
      payload.password = formData.password;
    }

    setSaving(true);
    try {
      if (isEditing) {
        const updated = await updateUser(editId, payload);
        if (isProfile) {
          updateSessionUser(updated);
        }
      } else {
        await createUser(payload);
      }
      setSubmitted(true);
      setTimeout(() => {
        if (isProfile) {
          navigate('/');
        } else if (isEditing) {
          navigate('/users');
        } else {
          navigate('/users');
        }
      }, 1500);
    } catch (err) {
      alert(err.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-surface">
        <Loader2 className="size-8 animate-spin text-brand" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-surface px-4">
        <p className="text-slate-600">{loadError}</p>
        <Link
          to="/users"
          className="rounded bg-sky-500 px-5 py-2.5 font-semibold text-white hover:bg-sky-600"
        >
          Back to Users
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-surface px-4 py-12">
      <div className="mx-auto max-w-xl rounded-lg bg-white p-6 shadow-sm sm:p-10">
        <h2 className="mb-2 text-center text-2xl font-semibold text-slate-800">
          {isProfile
            ? 'My Profile'
            : isEditing
              ? 'Edit User Profile'
              : 'Create Login Profile'}
        </h2>
        <p className="mb-8 text-center text-sm text-slate-500">
          {isProfile || isEditing
            ? 'Update profile details. Leave password blank to keep current.'
            : 'Register a new user for sign-in'}
        </p>

        {submitted && (
          <div className="mb-5 flex items-center justify-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="size-5 shrink-0" />
            Profile saved successfully! Redirecting...
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="fullName" className="text-sm font-semibold text-slate-800">
              Full Name *
            </label>
            <input
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              className={fieldClass(errors.fullName)}
              placeholder="John Doe"
            />
            {errors.fullName && (
              <span className="text-xs font-medium text-red-500">{errors.fullName}</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-sm font-semibold text-slate-800">
              Email *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              className={fieldClass(errors.email)}
              placeholder="john@example.com"
            />
            {errors.email && (
              <span className="text-xs font-medium text-red-500">{errors.email}</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="username" className="text-sm font-semibold text-slate-800">
              Username *
            </label>
            <input
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className={fieldClass(errors.username)}
              placeholder="johndoe"
              autoComplete="username"
            />
            {errors.username && (
              <span className="text-xs font-medium text-red-500">{errors.username}</span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="employeeId" className="text-sm font-semibold text-slate-800">
                Employee ID
              </label>
              <input
                id="employeeId"
                name="employeeId"
                value={formData.employeeId}
                onChange={handleChange}
                className={fieldClass(false)}
                placeholder="E1234"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="reportingManager" className="text-sm font-semibold text-slate-800">
                Reporting Manager
              </label>
              <select
                id="reportingManager"
                name="reportingManager"
                value={formData.reportingManager}
                onChange={handleChange}
                className={fieldClass(false)}
              >
                <option value="">Select reporting manager</option>
                {managers.map((manager) => {
                  const managerName = manager.fullName || manager.username || manager.email || 'Unnamed manager';
                  return (
                    <option key={manager.id || manager.username || manager.email} value={managerName}>
                      {managerName}
                    </option>
                  );
                })}
                {formData.reportingManager &&
                  !managers.some((manager) => {
                    const managerName = manager.fullName || manager.username || manager.email || 'Unnamed manager';
                    return managerName === formData.reportingManager;
                  }) && (
                    <option value={formData.reportingManager}>{formData.reportingManager} (Current)</option>
                  )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="region" className="text-sm font-semibold text-slate-800">
                Region
              </label>
              <input
                id="region"
                name="region"
                value={formData.region}
                onChange={handleChange}
                className={fieldClass(false)}
                placeholder="North America"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="status" className="text-sm font-semibold text-slate-800">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className={fieldClass(false)}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="phone" className="text-sm font-semibold text-slate-800">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={fieldClass(false)}
              placeholder="+1 555 000 0000"
            />
          </div>

          {isAdmin && !isProfile && (
            <div className="flex flex-col gap-2">
              <label htmlFor="role" className="text-sm font-semibold text-slate-800">
                Role
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className={fieldClass(false)}
              >
                <option value="Executive">Executive</option>
                <option value="Manager">Manager</option>
                <option value="Director">Director</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm font-semibold text-slate-800">
              Password {isEditing ? '(optional)' : '*'}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              className={fieldClass(errors.password)}
              placeholder={isEditing ? 'Leave blank to keep current' : 'Min. 6 characters'}
              autoComplete="new-password"
            />
            {errors.password && (
              <span className="text-xs font-medium text-red-500">{errors.password}</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="confirmPassword"
              className="text-sm font-semibold text-slate-800"
            >
              Confirm Password {isEditing && !formData.password ? '(optional)' : '*'}
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={fieldClass(errors.confirmPassword)}
              placeholder="Re-enter password"
              autoComplete="new-password"
            />
            {errors.confirmPassword && (
              <span className="text-xs font-medium text-red-500">
                {errors.confirmPassword}
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap justify-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded bg-emerald-600 px-8 py-3 text-base font-semibold text-white transition-all hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEditing ? 'Save Profile' : 'Create Profile'}
            </button>
            <button
              type="button"
              onClick={() => navigate(isProfile ? '/' : '/users')}
              className="rounded bg-slate-400 px-8 py-3 text-base font-semibold text-white hover:bg-slate-500"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
