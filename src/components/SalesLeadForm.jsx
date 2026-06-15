import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { CheckCircle2, Loader2, Search, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  createSalesLead,
  updateSalesLead,
  getSalesLeadById,
} from '../utils/salesLeadStorage';
import { getContacts } from '../utils/contactStorage';
import { getAccounts } from '../utils/accountStorage';
import { getSalesRegions } from '../utils/salesRegionStorage';
import { getLeadSources } from '../utils/leadSourceStorage';

const fieldClass = (hasError) =>
  [
    'w-full rounded border px-3 py-3 text-sm transition-colors focus:outline-none focus:ring-3',
    hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10'
      : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500/10',
  ].join(' ');

const emptyForm = () => ({
  title: '',
  receivedDate: new Date().toISOString().split('T')[0],
  salesPoc: '',
  salutation: '',
  leadContact: '',
  leadContactId: '',
  leadStatus: 'New',
  leadRating: 'Warm',
  nextContactDate: '',
  leadRegion: '',
  leadSource: '',
  referredBy: '',
  notes: '',
  description: '',
  productType: '',
  targetDealAmount: '',
  attachments: '',
  companyName: '',
  companyId: '',
  tasks: '',
  activities: '',
  createdBy: '',
  createdDate: '',
  updatedBy: '',
  updatedDate: '',
});

const leadStatusOptions = [
  'New',
  'Qualified',
  'Contacted',
  'Converted',
  'Not Qualified',
  'Follow-up',
  'Lost',
  'Junk',
  'Not Contacted',
];

const leadRatingOptions = ['Hot', 'Warm', 'Cold'];

export default function SalesLeadForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { currentUser } = useAuth();

  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [contacts, setContacts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [regions, setRegions] = useState([]);
  const [sources, setSources] = useState([]);
  const [contactFilter, setContactFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [loadedContacts, loadedAccounts, loadedRegions, loadedSources] =
          await Promise.all([
            getContacts(),
            getAccounts(),
            getSalesRegions(),
            getLeadSources(),
          ]);
        setContacts(loadedContacts);
        setAccounts(loadedAccounts);
        setRegions(loadedRegions);
        setSources(loadedSources);
      } catch (err) {
        setLoadError(err.message || 'Failed to load lookup data');
      } finally {
        setOptionsLoading(false);
      }
    };

    loadOptions();
  }, []);

  useEffect(() => {
    if (!isEditing) return;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setLoadError('');
        const lead = await getSalesLeadById(id);
        if (!cancelled) {
          setFormData({
            title: lead.title || '',
            receivedDate: lead.receivedDate || new Date().toISOString().split('T')[0],
            salesPoc: lead.salesPoc || '',
            salutation: lead.salutation || '',
            leadContact: lead.leadContact || '',
            leadContactId: lead.leadContactId || '',
            leadStatus: lead.leadStatus || 'New',
            leadRating: lead.leadRating || 'Warm',
            nextContactDate: lead.nextContactDate || '',
            leadRegion: lead.leadRegion || '',
            leadSource: lead.leadSource || '',
            referredBy: lead.referredBy || '',
            notes: lead.notes || '',
            description: lead.description || '',
            productType: lead.productType || '',
            targetDealAmount: lead.targetDealAmount || '',
            attachments: lead.attachments || '',
            companyName: lead.companyName || '',
            companyId: lead.companyId || '',
            tasks: lead.tasks || '',
            activities: lead.activities || '',
            createdBy: lead.createdBy || '',
            createdDate: lead.createdDate || '',
            updatedBy: lead.updatedBy || '',
            updatedDate: lead.updatedDate || '',
          });
        }
      } catch {
        if (!cancelled) {
          setLoadError('Could not load sales lead. It may have been deleted.');
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

  const contactOptions = contacts.filter((contact) => {
    const search = contactFilter.trim().toLowerCase();
    if (!search) return true;
    return [contact.firstName, contact.lastName, contact.email, contact.mobile]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(search));
  });

  const accountOptions = accounts.filter((account) => {
    const search = companyFilter.trim().toLowerCase();
    if (!search) return true;
    return [account.companyName, account.region, account.industry]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(search));
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }

    if (name === 'leadContact') {
      const selected = contacts.find(
        (contact) =>
          `${contact.firstName} ${contact.lastName}`.toLowerCase() ===
          value.trim().toLowerCase()
      );
      setFormData((prev) => ({
        ...prev,
        leadContactId: selected ? selected.id : '',
      }));
    }

    if (name === 'companyName') {
      const selected = accounts.find(
        (account) => account.companyName.toLowerCase() === value.trim().toLowerCase()
      );
      setFormData((prev) => ({
        ...prev,
        companyId: selected ? selected.id : '',
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.title.trim()) {
      newErrors.title = 'Lead title is required';
    }
    if (!formData.salesPoc.trim()) {
      newErrors.salesPoc = 'Sales POC is required';
    }
    if (!formData.leadRegion.trim()) {
      newErrors.leadRegion = 'Lead region is required';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    if (!formData.productType.trim()) {
      newErrors.productType = 'Product type is required';
    }
    if (!formData.companyName.trim()) {
      newErrors.companyName = 'Company name is required';
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
      title: formData.title.trim(),
      receivedDate: formData.receivedDate || new Date().toISOString().split('T')[0],
      salesPoc: formData.salesPoc.trim(),
      salutation: formData.salutation.trim(),
      leadContact: formData.leadContact.trim(),
      leadContactId: formData.leadContactId,
      leadStatus: formData.leadStatus,
      leadRating: formData.leadRating,
      nextContactDate: formData.nextContactDate || '',
      leadRegion: formData.leadRegion,
      leadSource: formData.leadSource,
      referredBy: formData.referredBy.trim(),
      notes: formData.notes.trim(),
      description: formData.description.trim(),
      productType: formData.productType.trim(),
      targetDealAmount: formData.targetDealAmount.trim(),
      attachments: formData.attachments.trim(),
      companyName: formData.companyName.trim(),
      companyId: formData.companyId,
      tasks: formData.tasks.trim(),
      activities: formData.activities.trim(),
      createdBy:
        formData.createdBy || currentUser?.fullName || currentUser?.username || 'System',
      createdDate: formData.createdDate || new Date().toISOString(),
      updatedBy: currentUser?.fullName || currentUser?.username || 'System',
      updatedDate: new Date().toISOString(),
    };

    setSaving(true);
    try {
      if (isEditing) {
        await updateSalesLead(id, payload);
      } else {
        await createSalesLead(payload);
      }
      setSubmitted(true);
      setTimeout(() => navigate('/sales-leads'), 1500);
    } catch (err) {
      alert(err.message || 'Failed to save sales lead');
    } finally {
      setSaving(false);
    }
  };

  if (loading || optionsLoading) {
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
          onClick={() => navigate('/sales-leads')}
          className="rounded bg-sky-500 px-5 py-2.5 font-semibold text-white hover:bg-sky-600"
        >
          Back to Sales Leads
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-surface px-4 py-12">
      <div className="mx-auto max-w-5xl rounded-lg bg-white p-6 shadow-sm sm:p-10">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-800">
              {isEditing ? 'Edit Sales Lead' : 'Create New Sales Lead'}
            </h2>
            <p className="text-sm text-slate-500">
              {isEditing
                ? 'Update sales lead details.'
                : 'Enter required details to add a new sales lead.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/sales-leads')}
              className="rounded bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
            >
              Back to Sales Leads
            </button>
            <Link
              to="/contacts/new"
              className="inline-flex items-center gap-2 rounded bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
            >
              <Plus className="size-4" />
              New Contact
            </Link>
          </div>
        </div>

        {submitted && (
          <div className="mb-5 flex items-center justify-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="size-5 shrink-0" />
            {isEditing
              ? 'Sales lead updated successfully. Redirecting...'
              : 'Sales lead created successfully. Redirecting...'}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-5 rounded-lg border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                Lead Details
              </h3>
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="title" className="text-sm font-semibold text-slate-800">
                    Lead Title *
                  </label>
                  <input
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    className={fieldClass(errors.title)}
                    placeholder="E.g. New Enterprise Opportunity"
                  />
                  {errors.title && (
                    <span className="text-xs font-medium text-red-500">
                      {errors.title}
                    </span>
                  )}
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="receivedDate" className="text-sm font-semibold text-slate-800">
                      Received Date
                    </label>
                    <input
                      id="receivedDate"
                      name="receivedDate"
                      type="date"
                      value={formData.receivedDate}
                      onChange={handleChange}
                      className={fieldClass(false)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="salesPoc" className="text-sm font-semibold text-slate-800">
                      Sales POC *
                    </label>
                    <input
                      id="salesPoc"
                      name="salesPoc"
                      value={formData.salesPoc}
                      onChange={handleChange}
                      className={fieldClass(errors.salesPoc)}
                      placeholder="Primary sales point of contact"
                    />
                    {errors.salesPoc && (
                      <span className="text-xs font-medium text-red-500">
                        {errors.salesPoc}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="leadStatus" className="text-sm font-semibold text-slate-800">
                      Lead Status
                    </label>
                    <select
                      id="leadStatus"
                      name="leadStatus"
                      value={formData.leadStatus}
                      onChange={handleChange}
                      className={fieldClass(false)}
                    >
                      {leadStatusOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="leadRating" className="text-sm font-semibold text-slate-800">
                      Lead Rating
                    </label>
                    <select
                      id="leadRating"
                      name="leadRating"
                      value={formData.leadRating}
                      onChange={handleChange}
                      className={fieldClass(false)}
                    >
                      {leadRatingOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="leadRegion" className="text-sm font-semibold text-slate-800">
                      Lead Region *
                    </label>
                    <select
                      id="leadRegion"
                      name="leadRegion"
                      value={formData.leadRegion}
                      onChange={handleChange}
                      className={fieldClass(errors.leadRegion)}
                    >
                      <option value="">Select a region</option>
                      {regions.map((region) => (
                        <option key={region.id} value={region.name}>
                          {region.name}
                        </option>
                      ))}
                    </select>
                    {errors.leadRegion && (
                      <span className="text-xs font-medium text-red-500">
                        {errors.leadRegion}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="leadSource" className="text-sm font-semibold text-slate-800">
                      Lead Source
                    </label>
                    <select
                      id="leadSource"
                      name="leadSource"
                      value={formData.leadSource}
                      onChange={handleChange}
                      className={fieldClass(false)}
                    >
                      <option value="">Select a source</option>
                      {sources.map((source) => (
                        <option key={source.id} value={source.name}>
                          {source.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="nextContactDate" className="text-sm font-semibold text-slate-800">
                      Next Contact Date
                    </label>
                    <input
                      id="nextContactDate"
                      name="nextContactDate"
                      type="date"
                      value={formData.nextContactDate}
                      onChange={handleChange}
                      className={fieldClass(false)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5 rounded-lg border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                Contact + Company
              </h3>
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="leadContact" className="text-sm font-semibold text-slate-800">
                    Lead Contact
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="leadContact"
                      name="leadContact"
                      list="contacts-list"
                      value={formData.leadContact}
                      onChange={handleChange}
                      className={fieldClass(false)}
                      placeholder="Start typing a contact name"
                    />
                    <Link
                      to="/contacts/new"
                      className="rounded bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
                    >
                      New Contact
                    </Link>
                  </div>
                  <datalist id="contacts-list">
                    {contactOptions.map((contact) => (
                      <option
                        key={contact.id}
                        value={`${contact.firstName} ${contact.lastName}`}
                      />
                    ))}
                  </datalist>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="companyName" className="text-sm font-semibold text-slate-800">
                    Company Name *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="companyName"
                      name="companyName"
                      list="accounts-list"
                      value={formData.companyName}
                      onChange={handleChange}
                      className={fieldClass(errors.companyName)}
                      placeholder="Search or type company name"
                    />
                    <Link
                      to="/accounts/new"
                      className="rounded bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
                    >
                      New Company
                    </Link>
                  </div>
                  {errors.companyName && (
                    <span className="text-xs font-medium text-red-500">
                      {errors.companyName}
                    </span>
                  )}
                  <datalist id="accounts-list">
                    {accountOptions.map((account) => (
                      <option key={account.id} value={account.companyName} />
                    ))}
                  </datalist>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="referredBy" className="text-sm font-semibold text-slate-800">
                    Referred By
                  </label>
                  <input
                    id="referredBy"
                    name="referredBy"
                    value={formData.referredBy}
                    onChange={handleChange}
                    className={fieldClass(false)}
                    placeholder="Referral source or partner"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-5 rounded-lg border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                Lead Narrative
              </h3>
              <div className="grid gap-5">
                <div className="flex flex-col gap-2">
                  <label htmlFor="description" className="text-sm font-semibold text-slate-800">
                    Description *
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    className={fieldClass(errors.description)}
                    rows="5"
                    placeholder="Provide a short summary of the lead and requirements"
                  />
                  {errors.description && (
                    <span className="text-xs font-medium text-red-500">
                      {errors.description}
                    </span>
                  )}
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="productType" className="text-sm font-semibold text-slate-800">
                      Product Type *
                    </label>
                    <input
                      id="productType"
                      name="productType"
                      value={formData.productType}
                      onChange={handleChange}
                      className={fieldClass(errors.productType)}
                      placeholder="Product category or service"
                    />
                    {errors.productType && (
                      <span className="text-xs font-medium text-red-500">
                        {errors.productType}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="targetDealAmount" className="text-sm font-semibold text-slate-800">
                      Target Deal Amount
                    </label>
                    <input
                      id="targetDealAmount"
                      name="targetDealAmount"
                      value={formData.targetDealAmount}
                      onChange={handleChange}
                      className={fieldClass(false)}
                      placeholder="e.g. 150000"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="attachments" className="text-sm font-semibold text-slate-800">
                    Attachments
                  </label>
                  <input
                    id="attachments"
                    name="attachments"
                    value={formData.attachments}
                    onChange={handleChange}
                    className={fieldClass(false)}
                    placeholder="File names or URLs"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-5 rounded-lg border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                Activities
              </h3>
              <div className="space-y-5">
                <div className="flex flex-col gap-2">
                  <label htmlFor="tasks" className="text-sm font-semibold text-slate-800">
                    Tasks
                  </label>
                  <textarea
                    id="tasks"
                    name="tasks"
                    value={formData.tasks}
                    onChange={handleChange}
                    className={fieldClass(false)}
                    rows="4"
                    placeholder="Task list or next steps"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="activities" className="text-sm font-semibold text-slate-800">
                    Activities
                  </label>
                  <textarea
                    id="activities"
                    name="activities"
                    value={formData.activities}
                    onChange={handleChange}
                    className={fieldClass(false)}
                    rows="4"
                    placeholder="Notes about calls, emails, meetings"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/sales-leads')}
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
              {isEditing ? 'Save Changes' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
