import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import {
  saveEnquiry,
  updateEnquiry,
  getEnquiryById,
} from '../utils/enquiryStorage';
import { getCustomerName } from '../utils/enquiryFields';

const fieldClass = (hasError) =>
  [
    'w-full rounded border px-3 py-3 text-sm transition-colors focus:outline-none focus:ring-3',
    hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10'
      : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500/10',
  ].join(' ');

const emptyForm = () => ({
  enquiryNo: '',
  salesPoc: '',
  region: '',
  customerName: '',
  contactPerson: '',
  contactMobile: '',
  contactEmail: '',
  description: '',
  date: new Date().toISOString().split('T')[0],
  notes: '',
});

function enquiryToForm(enquiry) {
  return {
    enquiryNo: enquiry.enquiryNo || '',
    salesPoc: enquiry.salesPoc || '',
    region: enquiry.region || '',
    customerName: getCustomerName(enquiry),
    contactPerson: enquiry.contactPerson || '',
    contactMobile: enquiry.contactMobile || '',
    contactEmail: enquiry.contactEmail || '',
    description: enquiry.description || '',
    date: enquiry.date || new Date().toISOString().split('T')[0],
    notes: enquiry.notes || '',
  };
}

export default function IntakeForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setLoadError('');
        const enquiry = await getEnquiryById(id);
        if (!cancelled) {
          setFormData(enquiryToForm(enquiry));
        }
      } catch {
        if (!cancelled) {
          setLoadError('Could not load enquiry. It may have been deleted.');
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
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.enquiryNo.trim()) {
      newErrors.enquiryNo = 'Enquiry number is required';
    }
    if (!formData.salesPoc.trim()) {
      newErrors.salesPoc = 'Sales POC is required';
    }
    if (!formData.region.trim()) {
      newErrors.region = 'Region is required';
    }
    if (!formData.customerName.trim()) {
      newErrors.customerName = 'Customer name is required';
    }
    if (!formData.contactPerson.trim()) {
      newErrors.contactPerson = 'Contact person is required';
    }
    if (!formData.contactMobile.trim()) {
      newErrors.contactMobile = 'Contact mobile is required';
    }
    if (!formData.contactEmail.trim()) {
      newErrors.contactEmail = 'Contact email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
      newErrors.contactEmail = 'Enter a valid email address';
    }
    if (!formData.date) {
      newErrors.date = 'Date is required';
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

    setSaving(true);
    try {
      if (isEditing) {
        await updateEnquiry(id, formData);
      } else {
        await saveEnquiry(formData);
      }

      setSubmitted(true);
      if (!isEditing) {
        setFormData(emptyForm());
      }
      setTimeout(() => {
        setSubmitted(false);
        navigate('/');
      }, 2000);
    } catch {
      alert(
        isEditing
          ? 'Error updating enquiry. Please try again.'
          : 'Error saving enquiry. Please try again.'
      );
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
          onClick={() => navigate('/')}
          className="rounded bg-sky-500 px-5 py-2.5 font-semibold text-white hover:bg-sky-600"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const labelClass = 'text-sm font-semibold text-slate-800';

  return (
    <div className="min-h-full bg-surface px-4 py-12">
      <div className="mx-auto max-w-2xl rounded-lg bg-white p-6 shadow-sm sm:p-10">
        <h2 className="mb-8 text-center text-2xl font-semibold text-slate-800">
          {isEditing ? 'Edit Enquiry' : 'New Intake Enquiry'}
        </h2>

        {submitted && (
          <div className="mb-5 flex items-center justify-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-4 py-4 text-center text-sm font-medium text-emerald-800">
            <CheckCircle2 className="size-5 shrink-0" />
            {isEditing
              ? 'Enquiry updated successfully! Redirecting...'
              : 'Enquiry submitted successfully! Redirecting to dashboard...'}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <section className="flex flex-col gap-5">
            <h3 className="border-b border-slate-100 pb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">
              Enquiry
            </h3>
            <div className="flex flex-col gap-2">
              <label htmlFor="enquiryNo" className={labelClass}>
                Enquiry No *
              </label>
              <input
                type="text"
                id="enquiryNo"
                name="enquiryNo"
                value={formData.enquiryNo}
                onChange={handleChange}
                className={fieldClass(errors.enquiryNo)}
                placeholder="Internal reference / ticket number"
              />
              {errors.enquiryNo && (
                <span className="text-xs font-medium text-red-500">
                  {errors.enquiryNo}
                </span>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-5">
            <h3 className="border-b border-slate-100 pb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">
              Sales & Region
            </h3>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="salesPoc" className={labelClass}>
                  Sales POC *
                </label>
                <input
                  type="text"
                  id="salesPoc"
                  name="salesPoc"
                  value={formData.salesPoc}
                  onChange={handleChange}
                  className={fieldClass(errors.salesPoc)}
                  placeholder="Sales point of contact"
                />
                {errors.salesPoc && (
                  <span className="text-xs font-medium text-red-500">
                    {errors.salesPoc}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="region" className={labelClass}>
                  Region *
                </label>
                <input
                  type="text"
                  id="region"
                  name="region"
                  value={formData.region}
                  onChange={handleChange}
                  className={fieldClass(errors.region)}
                  placeholder="e.g. North, APAC"
                />
                {errors.region && (
                  <span className="text-xs font-medium text-red-500">
                    {errors.region}
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-5">
            <h3 className="border-b border-slate-100 pb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">
              Customer
            </h3>
            <div className="flex flex-col gap-2">
              <label htmlFor="customerName" className={labelClass}>
                Name of the Customer *
              </label>
              <input
                type="text"
                id="customerName"
                name="customerName"
                value={formData.customerName}
                onChange={handleChange}
                className={fieldClass(errors.customerName)}
                placeholder="Customer / company name"
              />
              {errors.customerName && (
                <span className="text-xs font-medium text-red-500">
                  {errors.customerName}
                </span>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-5">
            <h3 className="border-b border-slate-100 pb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">
              Contact Person
            </h3>
            <div className="flex flex-col gap-2">
              <label htmlFor="contactPerson" className={labelClass}>
                Contact Person *
              </label>
              <input
                type="text"
                id="contactPerson"
                name="contactPerson"
                value={formData.contactPerson}
                onChange={handleChange}
                className={fieldClass(errors.contactPerson)}
                placeholder="Primary contact name"
              />
              {errors.contactPerson && (
                <span className="text-xs font-medium text-red-500">
                  {errors.contactPerson}
                </span>
              )}
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="contactMobile" className={labelClass}>
                  Contact Person Mobile *
                </label>
                <input
                  type="tel"
                  id="contactMobile"
                  name="contactMobile"
                  value={formData.contactMobile}
                  onChange={handleChange}
                  className={fieldClass(errors.contactMobile)}
                  placeholder="+1 555 000 0000"
                />
                {errors.contactMobile && (
                  <span className="text-xs font-medium text-red-500">
                    {errors.contactMobile}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="contactEmail" className={labelClass}>
                  Contact Person Email *
                </label>
                <input
                  type="email"
                  id="contactEmail"
                  name="contactEmail"
                  value={formData.contactEmail}
                  onChange={handleChange}
                  className={fieldClass(errors.contactEmail)}
                  placeholder="contact@company.com"
                />
                {errors.contactEmail && (
                  <span className="text-xs font-medium text-red-500">
                    {errors.contactEmail}
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-5">
            <h3 className="border-b border-slate-100 pb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">
              Enquiry Details
            </h3>
            <div className="flex flex-col gap-2">
              <label htmlFor="date" className={labelClass}>
                Date *
              </label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className={fieldClass(errors.date)}
              />
              {errors.date && (
                <span className="text-xs font-medium text-red-500">
                  {errors.date}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="description" className={labelClass}>
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                className={`${fieldClass(false)} min-h-[100px] resize-y`}
                placeholder="Enquiry details, requirements, etc."
                rows={4}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="notes" className={labelClass}>
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className={`${fieldClass(false)} min-h-[80px] resize-y`}
                placeholder="Additional notes"
                rows={3}
              />
            </div>
          </section>

          <div className="flex flex-wrap justify-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded bg-emerald-600 px-8 py-3 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-md disabled:opacity-60"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Submit Enquiry'}
            </button>
            <button
              type="button"
              className="rounded bg-slate-400 px-8 py-3 text-base font-semibold text-white transition-colors hover:bg-slate-500"
              onClick={() => navigate('/')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
