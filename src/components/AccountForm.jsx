import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import {
  createAccount,
  updateAccount,
  getAccountById,
} from '../utils/accountStorage';
import { useAuth } from '../context/AuthContext';

const fieldClass = (hasError) =>
  [
    'w-full rounded border px-3 py-3 text-sm transition-colors focus:outline-none focus:ring-3',
    hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10'
      : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500/10',
  ].join(' ');

const emptyForm = () => ({
  companyName: '',
  address: '',
  city: '',
  state: '',
  country: '',
  pinZip: '',
  industry: '',
  website: '',
  phone: '',
  employees: '',
  annualRevenue: '',
  region: '',
  status: 'Active',
  health: 'Green',
  owner: '',
  startDate: new Date().toISOString().split('T')[0],
  gstNumber: '',
  description: '',
  notes: '',
  tasks: ''
});

export default function AccountForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { currentUser } = useAuth();

  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!isEditing) return;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setLoadError('');
        const account = await getAccountById(id);
        if (!cancelled) {
          setFormData({
            companyName: account.CompanyName || '',
            address: account.Address || '',
            city: account.City || '',
            state: account.State || '',
            country: account.Country || '',
            pinZip: account.PinZip || '',
            industry: account.Industry || '',
            website: account.Website || '',
            phone: account.Phone || '',
            employees: account.Employees || '',
            annualRevenue: account.AnnualRevenue || '',
            region: account.Region || '',
            status: account.Status || 'Active',
            health: account.Health || 'Green',
            owner: account.Owner || '',
            startDate: account.StartDate || new Date().toISOString().split('T')[0],
            gstNumber: account.GstNumber || '',
            description: account.Description || '',
            notes: account.Notes || '',
            tasks: account.Tasks || '',
            createdBy: account.CreatedBy || '',
            createdDate: account.CreatedDate || '',
            updatedBy: account.UpdatedBy || '',
            updatedDate: account.UpdatedDate || '',
          });
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError('Could not load account. It may have been deleted.');
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
  }, [id, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.companyName.trim()) {
      newErrors.companyName = 'Company name is required';
    }
    if (!formData.owner.trim()) {
      newErrors.owner = 'Account owner is required';
    }
    if (!formData.region.trim()) {
      newErrors.region = 'Region is required';
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
      companyName: formData.companyName.trim(),
      address: formData.address.trim(),
      city: formData.city.trim(),
      state: formData.state.trim(),
      country: formData.country.trim(),
      pinZip: formData.pinZip.trim(),
      industry: formData.industry.trim(),
      website: formData.website.trim(),
      phone: formData.phone,
      employees: formData.employees,
      annualRevenue: formData.annualRevenue,
      region: formData.region.trim(),
      status: formData.status,
      health: formData.health,
      owner: formData.owner.trim(),
      startDate: formData.startDate,
      gstNumber: formData.gstNumber,
      description: formData.description.trim(),
      notes: formData.notes.trim(),
      tasks: formData.tasks.trim(),
      createdBy: formData.createdBy || currentUser?.fullName || currentUser?.username || 'System',
      createdDate: formData.createdDate || new Date().toISOString(),
      updatedBy: currentUser?.fullName || currentUser?.username || 'System',
      updatedDate: new Date().toISOString(),
    };

    setSaving(true);
    try {
      if (isEditing) {
        await updateAccount(id, payload);
      } else {
        await createAccount(payload);
      }
      setSubmitted(true);
      setTimeout(() => {
        navigate('/accounts');
      }, 1500);
    } catch (err) {
      alert(err.message || 'Failed to save account');
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
        <button
          type="button"
          onClick={() => navigate('/accounts')}
          className="rounded bg-sky-500 px-5 py-2.5 font-semibold text-white hover:bg-sky-600"
        >
          Back to Accounts
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-surface px-4 py-12">
      <div className="mx-auto max-w-4xl rounded-lg bg-white p-6 shadow-sm sm:p-10">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-800">
              {isEditing ? 'Edit Account' : 'Create New Account'}
            </h2>
            <p className="text-sm text-slate-500">
              {isEditing
                ? 'Update account details and save changes.'
                : 'Fill in required fields to add a new account.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/accounts')}
            className="rounded bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
          >
            Back to Accounts
          </button>
        </div>

        {submitted && (
          <div className="mb-5 flex items-center justify-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="size-5 shrink-0" />
            {isEditing
              ? 'Account updated successfully. Redirecting...'
              : 'Account created successfully. Redirecting...'}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="companyName" className="text-sm font-semibold text-slate-800">
                Company Name *
              </label>
              <input
                id="companyName"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                className={fieldClass(errors.companyName)}
                placeholder="Acme Corporation"
              />
              {errors.companyName && (
                <span className="text-xs font-medium text-red-500">
                  {errors.companyName}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="owner" className="text-sm font-semibold text-slate-800">
                Account Owner *
              </label>
              <input
                id="owner"
                name="owner"
                value={formData.owner}
                onChange={handleChange}
                className={fieldClass(errors.owner)}
                placeholder="Jane Smith"
              />
              {errors.owner && (
                <span className="text-xs font-medium text-red-500">
                  {errors.owner}
                </span>
              )}
            </div>
          </section>

          <section className="grid gap-5 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="address" className="text-sm font-semibold text-slate-800">Address</label>
              <input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className={fieldClass(false)}
                placeholder="123 Main Street"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="city" className="text-sm font-semibold text-slate-800">City</label>
              <input
                id="city"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className={fieldClass(false)}
                placeholder="Mumbai"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="state" className="text-sm font-semibold text-slate-800">State</label>
              <input
                id="state"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className={fieldClass(false)}
                placeholder="Maharashtra"
              />
            </div>
          </section>

          <section className="grid gap-5 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="country" className="text-sm font-semibold text-slate-800">Country</label>
              <input
                id="country"
                name="country"
                value={formData.country}
                onChange={handleChange}
                className={fieldClass(false)}
                placeholder="India"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="pinZip" className="text-sm font-semibold text-slate-800">Pin / Zip</label>
              <input
                id="pinZip"
                name="pinZip"
                value={formData.pinZip}
                onChange={handleChange}
                className={fieldClass(false)}
                placeholder="400001"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="industry" className="text-sm font-semibold text-slate-800">Industry</label>
              <input
                id="industry"
                name="industry"
                value={formData.industry}
                onChange={handleChange}
                className={fieldClass(false)}
                placeholder="Manufacturing"
              />
            </div>
          </section>

          <section className="grid gap-5 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="website" className="text-sm font-semibold text-slate-800">Website</label>
              <input
                id="website"
                name="website"
                value={formData.website}
                onChange={handleChange}
                className={fieldClass(false)}
                placeholder="https://example.com"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="phone" className="text-sm font-semibold text-slate-800">Phone</label>
              <input
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={fieldClass(false)}
                placeholder="+91 12345 67890"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="employees" className="text-sm font-semibold text-slate-800">No. of Employees</label>
              <input
                id="employees"
                name="employees"
                value={formData.employees}
                onChange={handleChange}
                className={fieldClass(false)}
                placeholder="100"
              />
            </div>
          </section>

          <section className="grid gap-5 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="annualRevenue" className="text-sm font-semibold text-slate-800">Annual Revenue</label>
              <input
                id="annualRevenue"
                name="annualRevenue"
                value={formData.annualRevenue}
                onChange={handleChange}
                className={fieldClass(false)}
                placeholder="₹1,00,00,000"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="region" className="text-sm font-semibold text-slate-800">Region *</label>
              <input
                id="region"
                name="region"
                value={formData.region}
                onChange={handleChange}
                className={fieldClass(errors.region)}
                placeholder="West"
              />
              {errors.region && (
                <span className="text-xs font-medium text-red-500">
                  {errors.region}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="status" className="text-sm font-semibold text-slate-800">Status</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className={fieldClass(false)}
              >
                <option value="Active">Active</option>
                <option value="In-Active">In-Active</option>
                <option value="Pending">Pending</option>
                <option value="Under-Review">Under-Review</option>
              </select>
            </div>
          </section>

          <section className="grid gap-5 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="health" className="text-sm font-semibold text-slate-800">Account Health</label>
              <select
                id="health"
                name="health"
                value={formData.health}
                onChange={handleChange}
                className={fieldClass(false)}
              >
                <option value="Green">Green</option>
                <option value="Yellow">Yellow</option>
                <option value="Red">Red</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="startDate" className="text-sm font-semibold text-slate-800">Account Start Date</label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                value={formData.startDate}
                onChange={handleChange}
                className={fieldClass(false)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="gstNumber" className="text-sm font-semibold text-slate-800">GST Number</label>
              <input
                id="gstNumber"
                name="gstNumber"
                value={formData.gstNumber}
                onChange={handleChange}
                className={fieldClass(false)}
                placeholder="27AAAAA0000A1Z5"
              />
            </div>
          </section>

          <section className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="description" className="text-sm font-semibold text-slate-800">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                className={fieldClass(false)}
                rows="4"
                placeholder="Summary of the account and relationship status"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="notes" className="text-sm font-semibold text-slate-800">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className={fieldClass(false)}
                rows="4"
                placeholder="Internal notes and observations"
              />
            </div>
          </section>

          <section className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="tasks" className="text-sm font-semibold text-slate-800">Tasks</label>
              <textarea
                id="tasks"
                name="tasks"
                value={formData.tasks}
                onChange={handleChange}
                className={fieldClass(false)}
                rows="4"
                placeholder="Open tasks for this account"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-800">Audit</label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p><strong>Created by:</strong> {formData.createdBy || currentUser?.fullName || currentUser?.username || 'System'}</p>
                <p><strong>Created date:</strong> {formData.createdDate ? new Date(formData.createdDate).toLocaleDateString() : 'Auto-set'}</p>
                <p><strong>Updated by:</strong> {formData.updatedBy || currentUser?.fullName || currentUser?.username || 'System'}</p>
                <p><strong>Updated date:</strong> {formData.updatedDate ? new Date(formData.updatedDate).toLocaleDateString() : 'Auto-set'}</p>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/accounts')}
              className="rounded bg-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
