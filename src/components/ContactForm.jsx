import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import {
  createContact,
  updateContact,
  getContactById,
} from '../utils/contactStorage';
import { useAuth } from '../context/AuthContext';

const fieldClass = (hasError) =>
  [
    'w-full rounded border px-3 py-3 text-sm transition-colors focus:outline-none focus:ring-3',
    hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10'
      : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500/10',
  ].join(' ');

const emptyForm = () => ({
  salutation: '',
  firstName: '',
  lastName: '',
  designation: '',
  department: '',
  mobile: '',
  email: '',
  status: 'Active',
  description: '',
  doNotCall: false,
  emailOptOut: false,
  fax: '',
  assistantName: '',
  assistantPhone: '',
  attachments: '',
  address: '',
  city: '',
  state: '',
  country: '',
  pinZip: '',
  notes: '',
  tasks: '',
  leads: [],
  createdBy: '',
  createdDate: '',
  updatedBy: '',
  updatedDate: '',
});

export default function ContactForm() {
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
        const contact = await getContactById(id);
        if (!cancelled) {
          setFormData({
            salutation: contact.salutation || '',
            firstName: contact.firstName || '',
            lastName: contact.lastName || '',
            designation: contact.designation || '',
            department: contact.department || '',
            mobile: contact.mobile || '',
            email: contact.email || '',
            status: contact.status || 'Active',
            description: contact.description || '',
            doNotCall: contact.doNotCall || false,
            emailOptOut: contact.emailOptOut || false,
            fax: contact.fax || '',
            assistantName: contact.assistantName || '',
            assistantPhone: contact.assistantPhone || '',
            attachments: contact.attachments || '',
            address: contact.address || '',
            city: contact.city || '',
            state: contact.state || '',
            country: contact.country || '',
            pinZip: contact.pinZip || '',
            notes: contact.notes || '',
            tasks: contact.tasks || '',
            leads: contact.leads || [],
            createdBy: contact.createdBy || '',
            createdDate: contact.createdDate || '',
            updatedBy: contact.updatedBy || '',
            updatedDate: contact.updatedDate || '',
          });
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError('Could not load contact. It may have been deleted.');
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
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (!formData.mobile.trim()) {
      newErrors.mobile = 'Mobile is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Enter a valid email address';
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
      salutation: formData.salutation.trim(),
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      designation: formData.designation.trim(),
      department: formData.department.trim(),
      mobile: formData.mobile.trim(),
      email: formData.email.trim(),
      status: formData.status,
      description: formData.description.trim(),
      doNotCall: formData.doNotCall,
      emailOptOut: formData.emailOptOut,
      fax: formData.fax.trim(),
      assistantName: formData.assistantName.trim(),
      assistantPhone: formData.assistantPhone.trim(),
      attachments: formData.attachments.trim(),
      address: formData.address.trim(),
      city: formData.city.trim(),
      state: formData.state.trim(),
      country: formData.country.trim(),
      pinZip: formData.pinZip.trim(),
      notes: formData.notes.trim(),
      tasks: formData.tasks.trim(),
      leads: formData.leads,
      createdBy: formData.createdBy || currentUser?.fullName || currentUser?.username || 'System',
      createdDate: formData.createdDate || new Date().toISOString(),
      updatedBy: currentUser?.fullName || currentUser?.username || 'System',
      updatedDate: new Date().toISOString(),
    };

    setSaving(true);
    try {
      if (isEditing) {
        await updateContact(id, payload);
      } else {
        await createContact(payload);
      }
      setSubmitted(true);
      setTimeout(() => {
        navigate('/contacts');
      }, 1500);
    } catch (err) {
      alert(err.message || 'Failed to save contact');
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
          onClick={() => navigate('/contacts')}
          className="rounded bg-sky-500 px-5 py-2.5 font-semibold text-white hover:bg-sky-600"
        >
          Back to Contacts
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
              {isEditing ? 'Edit Contact' : 'Create New Contact'}
            </h2>
            <p className="text-sm text-slate-500">
              {isEditing
                ? 'Update contact details.'
                : 'Fill in required fields to add a new contact.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/contacts')}
            className="rounded bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
          >
            Back to Contacts
          </button>
        </div>

        {submitted && (
          <div className="mb-5 flex items-center justify-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="size-5 shrink-0" />
            {isEditing
              ? 'Contact updated successfully. Redirecting...'
              : 'Contact created successfully. Redirecting...'}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="grid gap-5 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="salutation" className="text-sm font-semibold text-slate-800">
                Salutation
              </label>
              <input
                id="salutation"
                name="salutation"
                value={formData.salutation}
                onChange={handleChange}
                className={fieldClass(false)}
                placeholder="Mr / Ms / Dr"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="firstName" className="text-sm font-semibold text-slate-800">
                First Name *
              </label>
              <input
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className={fieldClass(errors.firstName)}
                placeholder="John"
              />
              {errors.firstName && (
                <span className="text-xs font-medium text-red-500">
                  {errors.firstName}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="lastName" className="text-sm font-semibold text-slate-800">
                Last Name *
              </label>
              <input
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className={fieldClass(errors.lastName)}
                placeholder="Doe"
              />
              {errors.lastName && (
                <span className="text-xs font-medium text-red-500">
                  {errors.lastName}
                </span>
              )}
            </div>
          </section>

          <section className="grid gap-5 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="designation" className="text-sm font-semibold text-slate-800">
                Designation
              </label>
              <input
                id="designation"
                name="designation"
                value={formData.designation}
                onChange={handleChange}
                className={fieldClass(false)}
                placeholder="Sales Manager"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="department" className="text-sm font-semibold text-slate-800">
                Department
              </label>
              <input
                id="department"
                name="department"
                value={formData.department}
                onChange={handleChange}
                className={fieldClass(false)}
                placeholder="Marketing"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="mobile" className="text-sm font-semibold text-slate-800">
                Mobile *
              </label>
              <input
                id="mobile"
                name="mobile"
                value={formData.mobile}
                onChange={handleChange}
                className={fieldClass(errors.mobile)}
                placeholder="+91 12345 67890"
              />
              {errors.mobile && (
                <span className="text-xs font-medium text-red-500">
                  {errors.mobile}
                </span>
              )}
            </div>
          </section>

          <section className="grid gap-5 sm:grid-cols-3">
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
                placeholder="john.doe@example.com"
              />
              {errors.email && (
                <span className="text-xs font-medium text-red-500">
                  {errors.email}
                </span>
              )}
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
                <option value="In-Active">In-Active</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-800">Preferences</label>
              <div className="grid gap-2">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="doNotCall"
                    checked={formData.doNotCall}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-slate-300 text-sky-600"
                  />
                  Do Not Call
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="emailOptOut"
                    checked={formData.emailOptOut}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-slate-300 text-sky-600"
                  />
                  Email Opt-Out
                </label>
              </div>
            </div>
          </section>

          <section className="grid gap-5 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="fax" className="text-sm font-semibold text-slate-800">
                Fax
              </label>
              <input
                id="fax"
                name="fax"
                value={formData.fax}
                onChange={handleChange}
                className={fieldClass(false)}
                placeholder="022 1234 5678"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="assistantName" className="text-sm font-semibold text-slate-800">
                Assistant Name
              </label>
              <input
                id="assistantName"
                name="assistantName"
                value={formData.assistantName}
                onChange={handleChange}
                className={fieldClass(false)}
                placeholder="Priya Kumar"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="assistantPhone" className="text-sm font-semibold text-slate-800">
                Assistant Phone
              </label>
              <input
                id="assistantPhone"
                name="assistantPhone"
                value={formData.assistantPhone}
                onChange={handleChange}
                className={fieldClass(false)}
                placeholder="+91 98765 43210"
              />
            </div>
          </section>

          <section className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="attachments" className="text-sm font-semibold text-slate-800">
                Attachments
              </label>
              <textarea
                id="attachments"
                name="attachments"
                value={formData.attachments}
                onChange={handleChange}
                className={fieldClass(false)}
                rows="3"
                placeholder="List filenames or attachment notes"
              />
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
                rows="3"
                placeholder="Contact summary or notes"
              />
            </div>
          </section>

          <section className="grid gap-5 sm:grid-cols-2">
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
          </section>

          <section className="grid gap-5 sm:grid-cols-3">
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
          </section>

          <section className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="notes" className="text-sm font-semibold text-slate-800">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className={fieldClass(false)}
                rows="4"
                placeholder="Internal notes"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="tasks" className="text-sm font-semibold text-slate-800">Tasks</label>
              <textarea
                id="tasks"
                name="tasks"
                value={formData.tasks}
                onChange={handleChange}
                className={fieldClass(false)}
                rows="4"
                placeholder="Pending tasks"
              />
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="font-semibold text-slate-800">Audit</p>
                <p>Created by: {formData.createdBy || currentUser?.fullName || currentUser?.username || 'System'}</p>
                <p>Created date: {formData.createdDate ? new Date(formData.createdDate).toLocaleDateString() : 'Auto-set'}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-800">Update Info</p>
                <p>Updated by: {formData.updatedBy || currentUser?.fullName || currentUser?.username || 'System'}</p>
                <p>Updated date: {formData.updatedDate ? new Date(formData.updatedDate).toLocaleDateString() : 'Auto-set'}</p>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/contacts')}
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
              {isEditing ? 'Save Changes' : 'Create Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
