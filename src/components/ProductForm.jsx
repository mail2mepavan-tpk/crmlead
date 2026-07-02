import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { createProduct, getProductById, updateProduct } from '../utils/productStorage';
import { useAuth } from '../context/AuthContext';

const fieldClass = (hasError) => [
  'w-full rounded border px-3 py-3 text-sm transition-colors focus:outline-none focus:ring-3',
  hasError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500/10',
].join(' ');

const emptyForm = () => ({
  productCode: '',
  productName: '',
  productDesciption: '',
});

export default function ProductForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { currentUser } = useAuth();

  const [formData, setFormData] = useState(emptyForm());
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
        const product = await getProductById(id);
        if (!cancelled) {
          setFormData({
            productCode: product.productCode || '',
            productName: product.productName || '',
            productDesciption: product.productDesciption || '',
          });
        }
      } catch {
        if (!cancelled) {
          setLoadError('Could not load product. It may have been deleted.');
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
    if (!formData.productCode.trim()) {
      newErrors.productCode = 'Product code is required';
    }
    if (!formData.productName.trim()) {
      newErrors.productName = 'Product name is required';
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
      productCode: formData.productCode.trim(),
      productName: formData.productName.trim(),
      productDesciption: formData.productDesciption.trim(),
      createdBy: currentUser?.fullName || currentUser?.username || 'System',
      createdDate: new Date().toISOString(),
      updatedBy: currentUser?.fullName || currentUser?.username || 'System',
      updatedDate: new Date().toISOString(),
    };

    setSaving(true);
    try {
      if (isEditing) {
        await updateProduct(id, payload);
      } else {
        await createProduct(payload);
      }
      setSubmitted(true);
      setTimeout(() => {
        navigate('/products');
      }, 1200);
    } catch (err) {
      alert(err.message || 'Failed to save product');
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
        <button type="button" onClick={() => navigate('/products')} className="rounded bg-sky-500 px-5 py-2.5 font-semibold text-white hover:bg-sky-600">
          Back to Products
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-surface px-4 py-12">
      <div className="mx-auto max-w-4xl rounded-lg bg-white p-6 shadow-sm sm:p-10">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-800">{isEditing ? 'Edit Product' : 'Create New Product'}</h2>
            <p className="text-sm text-slate-500">{isEditing ? 'Update the product details below.' : 'Add a new product to the catalog.'}</p>
          </div>
          <button type="button" onClick={() => navigate('/products')} className="rounded bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300">
            Back to Products
          </button>
        </div>

        {submitted && (
          <div className="mb-5 flex items-center justify-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="size-5 shrink-0" />
            {isEditing ? 'Product updated successfully. Redirecting...' : 'Product created successfully. Redirecting...'}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="productCode" className="text-sm font-semibold text-slate-800">Product Code *</label>
              <input id="productCode" name="productCode" value={formData.productCode} onChange={handleChange} className={fieldClass(errors.productCode)} placeholder="PRD-001" />
              {errors.productCode && <span className="text-xs font-medium text-red-500">{errors.productCode}</span>}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="productName" className="text-sm font-semibold text-slate-800">Product Name *</label>
              <input id="productName" name="productName" value={formData.productName} onChange={handleChange} className={fieldClass(errors.productName)} placeholder="Wireless Headphones" />
              {errors.productName && <span className="text-xs font-medium text-red-500">{errors.productName}</span>}
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label htmlFor="productDesciption" className="text-sm font-semibold text-slate-800">Description</label>
              <textarea id="productDesciption" name="productDesciption" value={formData.productDesciption} onChange={handleChange} rows="5" className={fieldClass(false)} placeholder="Describe the product" />
            </div>
          </section>

          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-6">
            <button type="button" onClick={() => navigate('/products')} className="rounded border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-70">
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {saving ? 'Saving...' : isEditing ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
