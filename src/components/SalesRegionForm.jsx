import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { createSalesRegion, updateSalesRegion, getSalesRegionById } from '../utils/salesRegionStorage';
import { useAuth } from '../context/AuthContext';

const fieldClass = (hasError) =>
  [
    'w-full rounded border px-3 py-3 text-sm transition-colors focus:outline-none focus:ring-3',
    hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10'
      : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500/10',
  ].join(' ');

const emptyForm = () => ({
  name: '',
  description: '',
  createdBy: '',
  createdDate: '',
  updatedBy: '',
  updatedDate: '',
});

export default function SalesRegionForm() {
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
        const region = await getSalesRegionById(id);
        if (!cancelled) {
          setFormData({
            name: region.name || '',
            description: region.description || '',
            createdBy: region.createdBy || '',
            createdDate: region.createdDate || '',
            updatedBy: region.updatedBy || '',
            updatedDate: region.updatedDate || '',
          });
        }
      } catch {
        if (!cancelled) {
          setLoadError('Could not load sales region. It may have been deleted.');
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
    if (!formData.name.trim()) {
      newErrors.name = 'Region name is required';
    }
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      createdBy: formData.createdBy || currentUser?.fullName || currentUser?.username || 'System',
      createdDate: formData.createdDate || new Date().toISOString(),
      updatedBy: currentUser?.fullName || currentUser?.username || 'System',
      updatedDate: new Date().toISOString(),
    };

    setSaving(true);
    try {
      if (isEditing) {
        await updateSalesRegion(id, payload);
      } else {
        await createSalesRegion(payload);
      }
      setSubmitted(true);
      setTimeout(() => navigate('/sales-regions'), 1500);
    } catch (err) {
      alert(err.message || 'Failed to save sales region');
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
          onClick={() => navigate('/sales-regions')}
          className="rounded bg-sky-500 px-5 py-2.5 font-semibold text-white hover:bg-sky-600"
        >
          Back to Sales Regions
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-surface px-4 py-12">
      <div className="mx-auto max-w-3xl rounded-lg bg-white p-6 shadow-sm sm:p-10">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-800">
              {isEditing ? 'Edit Sales Region' : 'Create New Sales Region'}
            </h2>
            <p className="text-sm text-slate-500">
              {isEditing
                ? 'Update region metadata.'
                : 'Add a new sales region for the CRM.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/sales-regions')}
            className="rounded bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
          >
            Back to Sales Regions
          </button>
        </div>

        {submitted && (
          <div className="mb-5 flex items-center justify-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="size-5 shrink-0" />
            {isEditing
              ? 'Sales region updated successfully. Redirecting...'
              : 'Sales region created successfully. Redirecting...'}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="name" className="text-sm font-semibold text-slate-800">
              Region Name *
            </label>
            <input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={fieldClass(errors.name)}
              placeholder="West"
            />
            {errors.name && (
              <span className="text-xs font-medium text-red-500">{errors.name}</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="description" className="text-sm font-semibold text-slate-800">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className={fieldClass(false)}
              rows="4"
              placeholder="Describe the sales region or territory."
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-800">Audit</p>
            <p>Created by: {formData.createdBy || currentUser?.fullName || currentUser?.username || 'System'}</p>
            <p>Created date: {formData.createdDate ? new Date(formData.createdDate).toLocaleDateString() : 'Auto-set'}</p>
            <p>Updated by: {formData.updatedBy || currentUser?.fullName || currentUser?.username || 'System'}</p>
            <p>Updated date: {formData.updatedDate ? new Date(formData.updatedDate).toLocaleDateString() : 'Auto-set'}</p>
          </div>

          <div className="flex flex-wrap justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/sales-regions')}
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
              {isEditing ? 'Save Changes' : 'Create Region'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
