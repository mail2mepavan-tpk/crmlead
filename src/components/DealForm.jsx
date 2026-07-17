import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { CheckCircle2, Loader2, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { createDeal, updateDeal, getDealById } from '../utils/dealStorage';
import { getAccounts } from '../utils/accountStorage';
import { getContacts } from '../utils/contactStorage';
import { getSalesLeads } from '../utils/salesLeadStorage';

const fieldClass = (hasError) =>
  [
    'w-full rounded border px-3 py-3 text-sm transition-colors focus:outline-none focus:ring-3',
    hasError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500/10',
  ].join(' ');

const emptyForm = () => ({
  dealName: '',
  account: '',
  accountId: '',
  primaryContact: '',
  primaryContactId: '',
  leadId: '',
  salesPoc: '',
  dealStage: 'New',
  dealAmount: '',
  probability: 0,
  expectedClosureDate: '',
  competitor: '',
  dealSource: '',
  productSubType: '',
  description: '',
  lostReason: '',
  wonDate: '',
  region: '',
  attachments: '',
  extraFields: {},
  notes: '',
  tasks: '',
  activities: '',
  createdBy: '',
  createdDate: '',
  updatedBy: '',
  updatedDate: '',
});

const stageOptions = ['New', 'Qualification', 'Proposal', 'Negotiation', 'Final Review', 'Won', 'Lost', 'Hold'];
const productSubTypeOptions = ['Hardware-1', 'Hardware-2', 'Hardware-3', 'Consumables-1', 'Consumables-2'];
const stageProbability = {
  Qualification: 10,
  Proposal: 30,
  Negotiation: 60,
  'Final Review': 80,
  Won: 100,
  Lost: 0,
};

export default function DealForm() {
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
  const [accounts, setAccounts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [salesLeads, setSalesLeads] = useState([]);
  const [salesLeadSearch, setSalesLeadSearch] = useState('');
  const [selectedSalesLead, setSelectedSalesLead] = useState(null);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [a, c, s] = await Promise.all([getAccounts(), getContacts(), getSalesLeads()]);
        setAccounts(a);
        setContacts(c);
        setSalesLeads(s);
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
        const deal = await getDealById(id);
        if (!cancelled) {
          setFormData({
            dealName: deal.dealName || '',
            account: deal.account || '',
            accountId: deal.accountId || '',
            primaryContact: deal.primaryContact || '',
            leadId: deal.leadId || '',
            salesPoc: deal.salesPoc || '',
            dealStage: deal.dealStage || 'New',
            dealAmount: deal.dealAmount || '',
            probability: deal.probability || 0,
            expectedClosureDate: deal.expectedClosureDate || '',
            competitor: deal.competitor || '',
            dealSource: deal.dealSource || '',
            productSubType: deal.productSubType || '',
            description: deal.description || '',
            lostReason: deal.lostReason || '',
            wonDate: deal.wonDate || '',
            region: deal.region || '',
            attachments: deal.attachments || '',
            extraFields: deal.extraFields || {},
            notes: deal.notes || '',
            tasks: deal.tasks || '',
            activities: deal.activities || '',
            createdBy: deal.createdBy || '',
            createdDate: deal.createdDate || '',
            updatedBy: deal.updatedBy || '',
            updatedDate: deal.updatedDate || '',
          });
        }
      } catch (err) {
        if (!cancelled) setLoadError('Could not load deal. It may have been deleted.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEditing]);

  const applySalesLead = (lead) => {
    setSelectedSalesLead(lead);
    setFormData((prev) => ({
      ...prev,
      dealName: lead.title || prev.dealName,
      account: lead.companyName || prev.account,
      accountId: lead.companyId || prev.accountId,
      primaryContact: lead.leadContact || prev.primaryContact,
      primaryContactId: lead.leadContactId || prev.primaryContactId,
      leadId: lead.id || prev.leadId,
      salesPoc: lead.salesPoc || prev.salesPoc,
      dealAmount: prev.dealAmount || lead.targetDealAmount,
      probability: stageProbability[lead.leadStatus] ?? prev.probability,
      description: lead.description || prev.description,
      dealSource: lead.leadSource || prev.dealSource,
      region: lead.leadRegion || prev.region,
      attachments: lead.attachments || prev.attachments,
      notes: lead.notes || prev.notes,
      tasks: lead.tasks || prev.tasks,
      activities: lead.activities || prev.activities,
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'salesLeadSearch') {
      setSalesLeadSearch(value);
      const selected = salesLeads.find((lead) => `${lead.title} - ${lead.companyName}`.toLowerCase() === value.trim().toLowerCase());
      if (selected) {
        applySalesLead(selected);
      } else {
        setSelectedSalesLead(null);
      }
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'dealStage') {
      const prob = stageProbability[value] ?? prev.probability;
      setFormData((prev) => ({ ...prev, probability: prob }));
    }
    if (name === 'account') {
      const selected = accounts.find((a) => a.companyName.toLowerCase() === value.trim().toLowerCase());
      setFormData((prev) => ({ ...prev, accountId: selected ? selected.id : '' }));
    }
    if (name === 'primaryContact') {
      const selected = contacts.find((c) => `${c.firstName} ${c.lastName}`.toLowerCase() === value.trim().toLowerCase());
      setFormData((prev) => ({ ...prev, primaryContact: value, primaryContactId: selected ? selected.id : '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.dealName.trim()) newErrors.dealName = 'Opportunity name is required';
    if (!formData.account.trim()) newErrors.account = 'Account is required';
    if (!formData.salesPoc?.trim()) newErrors.salesPoc = 'Sales POC is required';
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validateForm();
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }

    const payload = {
      ...formData,
      dealName: formData.dealName.trim(),
      account: formData.account.trim(),
      salesPoc: formData.salesPoc.trim(),
      probability: Number(formData.probability) || 0,
      productSubType: formData.productSubType.trim(),
      createdBy: formData.createdBy || currentUser?.fullName || currentUser?.username || 'System',
      createdDate: formData.createdDate || new Date().toISOString(),
      updatedBy: currentUser?.fullName || currentUser?.username || 'System',
      updatedDate: new Date().toISOString(),
    };

    setSaving(true);
    try {
      if (isEditing) {
        await updateDeal(id, payload);
      } else {
        await createDeal(payload);
      }
      setSubmitted(true);
      setTimeout(() => navigate('/deals'), 1200);
    } catch (err) {
      alert(err.message || 'Failed to save deal');
    } finally {
      setSaving(false);
    }
  };

  if (loading || optionsLoading) {
    return (<div className="flex min-h-full items-center justify-center bg-surface"><Loader2 className="size-8 animate-spin text-brand" /></div>);
  }

  if (loadError) {
    return (<div className="flex min-h-full flex-col items-center justify-center gap-4 bg-surface px-4"><p className="text-slate-600">{loadError}</p><button type="button" onClick={() => navigate('/deals')} className="rounded bg-sky-500 px-5 py-2.5 font-semibold text-white hover:bg-sky-600">Back to Opportunities</button></div>);
  }

  return (
    <div className="min-h-full bg-surface px-4 py-12">
      <div className="mx-auto max-w-5xl rounded-lg bg-white p-6 shadow-sm sm:p-10">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-800">{isEditing ? 'Edit Opportunity' : 'Create New Opportunity'}</h2>
            <p className="text-sm text-slate-500">{isEditing ? 'Update Opportunity details.' : 'Enter required details to add a new opportunity.'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => navigate('/deals')} className="rounded bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Back to Opportunities</button>
            <Link to="/accounts/new" className="inline-flex items-center gap-2 rounded bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"><Plus className="size-4" />New Account</Link>
          </div>
        </div>

        {submitted && (<div className="mb-5 flex items-center justify-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-800"><CheckCircle2 className="size-5 shrink-0" />{isEditing ? 'Deal updated successfully. Redirecting...' : 'Deal created successfully. Redirecting...'}</div>)}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-5 rounded-lg border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Opportunity Details</h3>
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-800">Sales Lead</label>
              <input
                name="salesLeadSearch"
                value={salesLeadSearch}
                onChange={handleChange}
                list="sales-leads-list"
                className={fieldClass(false)}
                placeholder="Search sales lead by title or company"
              />
              <datalist id="sales-leads-list">
                {salesLeads.map((lead) => (
                  <option
                    key={lead.id}
                    value={`${lead.title} - ${lead.companyName}`}
                  />
                ))}
              </datalist>
              {selectedSalesLead && (
                <p className="text-sm text-slate-600">Loaded sales lead #{selectedSalesLead.id}.</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-800">Opportunity Name *</label>
              <input
                name="dealName"
                value={formData.dealName}
                onChange={handleChange}
                readOnly={Boolean(selectedSalesLead)}
                className={fieldClass(errors.dealName)}
                placeholder="Opportunity title"
              />
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-800">Account *</label>
                    <div className="flex items-center gap-2">
                      <input name="account" list="accounts-list" value={formData.account} onChange={handleChange} className={fieldClass(errors.account)} placeholder="Search or type company name" />
                      <Link to="/accounts/new" className="rounded bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">New Company</Link>
                    </div>
                    {errors.account && <span className="text-xs font-medium text-red-500">{errors.account}</span>}
                    <datalist id="accounts-list">{accounts.map((a) => (<option key={a.id} value={a.companyName} />))}</datalist>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-800">Primary Contact</label>
                    <input name="primaryContact" list="contacts-list" value={formData.primaryContact} onChange={handleChange} className={fieldClass(false)} placeholder="Start typing a contact name" />
                    <datalist id="contacts-list">{contacts.map((c) => (<option key={c.id} value={`${c.firstName} ${c.lastName}`} />))}</datalist>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-800">Lead ID</label>
                    <input
                      name="leadId"
                      value={formData.leadId}
                      readOnly
                      className={fieldClass(false)}
                      placeholder="Auto-filled from sales lead"
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-800">Sales POC *</label>
                    <input
                      name="salesPoc"
                      value={formData.salesPoc}
                      onChange={handleChange}
                      readOnly={Boolean(selectedSalesLead)}
                      className={fieldClass(errors.salesPoc)}
                      placeholder="Sales point of contact"
                    />
                    {errors.salesPoc && <span className="text-xs font-medium text-red-500">{errors.salesPoc}</span>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-800">Deal Stage</label>
                    <select name="dealStage" value={formData.dealStage} onChange={handleChange} className={fieldClass(false)}>
                      {stageOptions.map((s) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-800">Opportunity Amount</label>
                    <input name="dealAmount" value={formData.dealAmount} onChange={handleChange} readOnly={Boolean(selectedSalesLead)} className={fieldClass(false)} placeholder="e.g. 150000" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-800">Probability %</label>
                    <input name="probability" type="number" value={formData.probability} onChange={handleChange} className={fieldClass(false)} />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-800">Product Subtype</label>
                  <select
                    name="productSubType"
                    value={formData.productSubType}
                    onChange={handleChange}
                    className={fieldClass(false)}
                  >
                    <option value="">Select subtype</option>
                    {productSubTypeOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-800">Expected Closure Date</label>
                    <input name="expectedClosureDate" type="date" value={formData.expectedClosureDate} onChange={handleChange} className={fieldClass(false)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-800">Region</label>
                    <input name="region" value={formData.region} onChange={handleChange} className={fieldClass(false)} />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5 rounded-lg border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Notes & Details</h3>
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-800">Description</label>
                  <textarea name="description" value={formData.description} onChange={handleChange} readOnly={Boolean(selectedSalesLead)} className={fieldClass(false)} rows="5" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-800">Competitor</label>
                  <input name="competitor" value={formData.competitor} onChange={handleChange} className={fieldClass(false)} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-800">Attachments</label>
                  <input name="attachments" value={formData.attachments} onChange={handleChange} readOnly={Boolean(selectedSalesLead)} className={fieldClass(false)} placeholder="File names or URLs" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-5 rounded-lg border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Activities</h3>
              <div className="space-y-5">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-800">Tasks</label>
                  <textarea name="tasks" value={formData.tasks} onChange={handleChange} className={fieldClass(false)} rows="4" />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-800">Activities</label>
                  <textarea name="activities" value={formData.activities} onChange={handleChange} className={fieldClass(false)} rows="4" />
                </div>
              </div>
            </div>

            <div className="space-y-5 rounded-lg border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Administrative</h3>
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-800">Lost Reason</label>
                  <input name="lostReason" value={formData.lostReason} onChange={handleChange} className={fieldClass(false)} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-800">Won Date</label>
                  <input name="wonDate" type="date" value={formData.wonDate} onChange={handleChange} className={fieldClass(false)} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-4">
            <button type="button" onClick={() => navigate('/deals')} className="rounded bg-slate-200 px-6 py-3 text-sm font-semibold text-slate-700">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Opportunity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
