import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Plus, Trash2, X } from 'lucide-react';
import {
  createQuote,
  updateQuote,
  getQuoteById,
  calculateLineTotal,
  calculateGST,
  calculateGrandTotal,
  numberToWords,
} from '../utils/quoteStorage';
import { getDealById } from '../utils/dealStorage';
import { getProducts } from '../utils/productStorage';
import { useAuth } from '../context/AuthContext';

const fieldClass = (hasError) =>
  [
    'w-full rounded border px-3 py-3 text-sm transition-colors focus:outline-none focus:ring-3',
    hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10'
      : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500/10',
  ].join(' ');

const indianStates = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

const emptyQuote = () => ({
  dealid: '',
  email: {
    subject: '',
    from: '',
    to: [],
    cc: [],
    replyTo: '',
  },
  company: {
    name: 'Aaruni Lifesciences Private Limited',
    companyId: 'U74999KA2021PTC146762',
    gstin: '29AAVCA1290J1Z4',
    address: 'V-29, 9th Main Road, 2nd Stage, Peenya Industrial Area, Bangalore, Karnataka - 560058',
  },
  quotation: {
    quoteNumber: 'ALS/26-27/' + Math.random().toString(36).substr(2, 4).toUpperCase() + '/HW',
    quoteType: 'Initial',
    quotationDate: new Date().toISOString().split('T')[0],
    expiryDate: '',
    placeOfSupply: '',
    reference: '',
    salesPerson: {
      name: '',
      phone: '',
    },
  },
  customer: {
    customerName: '',
    phone: '',
    email: '',
    billTo: {
      companyName: '',
      state: '',
      address: [],
    },
    shipTo: {
      companyName: '',
      address: [],
    },
  },
  items: [],
  commercials: {
    shippingCharges: 'At actuals',
    deliverySchedule: '',
    paymentTerms: '',
  },
  taxes: {
    gstPercentage: 18,
    gstAmount: 0,
  },
  totals: {
    subTotal: 0,
    grandTotal: 0,
    amountInWords: '',
  },
  bankDetails: {
    accountName: 'AARUNI LIFESCIENCES SOLUTIONS PRIVATE LIMITED',
    bankName: 'IDFC FIRST BANK',
    accountNumber: '10073636071',
    branchAddress: 'Ground Floor, Trinity Complex Kalyan Nagar ORR, Bangalore 560043',
  },
  signature: {
    authorizedPerson: 'Director',
  },
  status: 'Pending',
});

const emptyItem = () => ({
  lineNumber: 1,
  itemCode: '',
  productCode: '',
  productName: '',
  description: '',
  unitMeasurements: '',
  quantity: 1,
  unitPrice: 0,
  discountPercent: 0,
  discountAmount: 0,
  priceAfterDiscount: 0,
  lineTotal: 0,
});

export default function QuotationForm() {
  const navigate = useNavigate();
  const { id, dealId } = useParams();
  const isEditing = Boolean(id);
  const { currentUser } = useAuth();

  const [formData, setFormData] = useState(emptyQuote);
  const [items, setItems] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [products, setProducts] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await getProducts();
        setProducts(Array.isArray(data) ? data : []);
      } catch {
        setProducts([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isEditing) return;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setLoadError('');
        const quote = await getQuoteById(id);
        if (!cancelled) {
          setFormData(quote);
          setItems(quote.items || []);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError('Could not load quotation. It may have been deleted.');
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

  useEffect(() => {
    if (isEditing || !dealId) return;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setLoadError('');
        const deal = await getDealById(dealId);
        if (!cancelled) {
          setFormData((prev) => ({ ...prev, dealid: deal.id || dealId }));
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError('Could not load deal information.');
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
  }, [dealId, isEditing]);

  const handleQuotationChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      quotation: { ...prev.quotation, [name]: value },
    }));
    if (errors[`quotation.${name}`]) {
      setErrors((prev) => ({ ...prev, [`quotation.${name}`]: '' }));
    }
  };

  const handleCompanyChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      company: { ...prev.company, [name]: value },
    }));
    if (errors[`company.${name}`]) {
      setErrors((prev) => ({ ...prev, [`company.${name}`]: '' }));
    }
  };

  const handleCustomerChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      customer: { ...prev.customer, [name]: value },
    }));
    if (errors[`customer.${name}`]) {
      setErrors((prev) => ({ ...prev, [`customer.${name}`]: '' }));
    }
  };

  const handleEmailChange = (e) => {
    const { name, value } = e.target;
    if (name === 'to' || name === 'cc') {
      setFormData((prev) => ({
        ...prev,
        email: { ...prev.email, [name]: value.split(',').map(e => e.trim()) },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        email: { ...prev.email, [name]: value },
      }));
    }
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...items];
    const item = updatedItems[index];

    if (field === 'quantity' || field === 'unitPrice' || field === 'discountPercent') {
      item[field] = Number(value);
    } else {
      item[field] = value;
    }

    if (field === 'productCode') {
      const selectedProduct = products.find((product) => product.productCode === value);
      item.itemCode = selectedProduct?.productCode || '';
      item.description = selectedProduct?.productName || '';
      item.productName = selectedProduct?.productName || '';
      item.unitMeasurements = selectedProduct?.unitMeasurements || '';
      if (selectedProduct?.salePrice !== undefined && selectedProduct?.salePrice !== null && selectedProduct?.salePrice !== '') {
        item.unitPrice = Number(selectedProduct.salePrice);
      }
    }

    if (field === 'productName') {
      const selectedProduct = products.find((product) => product.productName === value);
      item.itemCode = selectedProduct?.productCode || '';
      item.description = selectedProduct?.productName || '';
      item.productCode = selectedProduct?.productCode || '';
      item.unitMeasurements = selectedProduct?.unitMeasurements || '';
      if (selectedProduct?.salePrice !== undefined && selectedProduct?.salePrice !== null && selectedProduct?.salePrice !== '') {
        item.unitPrice = Number(selectedProduct.salePrice);
      }
    }

    item.discountAmount = (item.unitPrice * item.quantity * item.discountPercent) / 100;
    item.priceAfterDiscount = item.quantity * item.unitPrice - item.discountAmount;
    item.lineTotal = item.priceAfterDiscount;

    setItems(updatedItems);
  };

  const addItem = () => {
    const newItem = { ...emptyItem(), lineNumber: items.length + 1 };
    setItems([...items, newItem]);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subTotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const gstRate = Number(formData.taxes.gstPercentage || 18);
    const gstAmount = Math.round(calculateGST(subTotal, gstRate));
    const shippingCharges = formData.commercials.shippingCharges === 'At actuals' ? 0 : Number(formData.commercials.shippingCharges || 0);
    const grandTotal = calculateGrandTotal(subTotal, gstAmount, shippingCharges);
    const amountInWords = numberToWords(grandTotal);
    const selectedState = (formData.customer.billTo.state || '').trim();
    const isKarnataka = selectedState.toLowerCase() === 'karnataka';
    const cgstAmount = Math.round(gstAmount / 2);
    const sgstAmount = gstAmount - cgstAmount;

    return {
      subTotal,
      gstAmount,
      cgstAmount,
      sgstAmount,
      grandTotal,
      amountInWords,
      isKarnataka,
    };
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.quotation.quoteNumber.trim()) {
      newErrors['quotation.quoteNumber'] = 'Quote number is required';
    }
    if (!formData.company.name.trim()) {
      newErrors['company.name'] = 'Company name is required';
    }
    if (!formData.customer.customerName.trim()) {
      newErrors['customer.customerName'] = 'Customer name is required';
    }
    if (!formData.customer.email.trim()) {
      newErrors['customer.email'] = 'Customer email is required';
    }
    if (items.length === 0) {
      newErrors.items = 'At least one item is required';
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

    const totals = calculateTotals();
    const payload = {
      ...formData,
      items,
      totals,
      taxes: {
        ...formData.taxes,
        gstAmount: totals.gstAmount,
      },
      status: formData.status || 'Pending',
    };

    try {
      setSaving(true);
      if (isEditing) {
        await updateQuote(id, payload);
      } else {
        await createQuote(payload);
      }
      navigate('/quotations');
    } catch (err) {
      setErrors({ submit: err.message || 'Error saving quotation' });
    } finally {
      setSaving(false);
    }
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-surface">
        <Loader2 className="size-8 animate-spin text-brand" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-full items-center justify-center bg-surface p-4">
        <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-red-700">
          {loadError}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-surface px-5 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-800">
            {isEditing ? 'Edit Quotation' : 'Create New Quotation'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isEditing ? 'Update quotation details' : 'Create a new customer quotation with line items and pricing'}
          </p>
        </div>

        {errors.submit && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errors.submit}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Quotation Details */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-800">Quotation Details - Deal # {dealId}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Quote Number *
                </label>
                <input
                  type="text"
                  name="quoteNumber"
                  value={formData.quotation.quoteNumber}
                  onChange={handleQuotationChange}
                  className={fieldClass(Boolean(errors['quotation.quoteNumber']))}
                  placeholder="e.g., ALS/26-27/113/HW"
                />
                {errors['quotation.quoteNumber'] && (
                  <p className="mt-1 text-xs text-red-600">{errors['quotation.quoteNumber']}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Quote Type
                </label>
                <select
                  name="quoteType"
                  value={formData.quotation.quoteType}
                  onChange={handleQuotationChange}
                  className={fieldClass(false)}
                >
                  <option>Initial</option>
                  <option>Revised</option>
                  <option>Final</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Quotation Date
                </label>
                <input
                  type="date"
                  name="quotationDate"
                  value={formData.quotation.quotationDate}
                  onChange={handleQuotationChange}
                  className={fieldClass(false)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Expiry Date
                </label>
                <input
                  type="date"
                  name="expiryDate"
                  value={formData.quotation.expiryDate}
                  onChange={handleQuotationChange}
                  className={fieldClass(false)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Place of Supply
                </label>
                <input
                  type="text"
                  name="placeOfSupply"
                  value={formData.quotation.placeOfSupply}
                  onChange={handleQuotationChange}
                  className={fieldClass(false)}
                  placeholder="e.g., Hyderabad"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Reference
                </label>
                <input
                  type="text"
                  name="reference"
                  value={formData.quotation.reference}
                  onChange={handleQuotationChange}
                  className={fieldClass(false)}
                  placeholder="e.g., Visit"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sales Person Name
                </label>
                <input
                  type="text"
                  value={formData.quotation.salesPerson.name}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      quotation: {
                        ...prev.quotation,
                        salesPerson: { ...prev.quotation.salesPerson, name: e.target.value },
                      },
                    }))
                  }
                  className={fieldClass(false)}
                  placeholder="Sales person name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sales Person Phone
                </label>
                <input
                  type="tel"
                  value={formData.quotation.salesPerson.phone}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      quotation: {
                        ...prev.quotation,
                        salesPerson: { ...prev.quotation.salesPerson, phone: e.target.value },
                      },
                    }))
                  }
                  className={fieldClass(false)}
                  placeholder="Phone number"
                />
              </div>
            </div>
          </div>

          {/* Company Details */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-800">Company Details</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.company.name}
                  onChange={handleCompanyChange}
                  className={fieldClass(Boolean(errors['company.name']))}
                  placeholder="Company name"
                />
                {errors['company.name'] && (
                  <p className="mt-1 text-xs text-red-600">{errors['company.name']}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Company ID
                </label>
                <input
                  type="text"
                  name="companyId"
                  value={formData.company.companyId}
                  onChange={handleCompanyChange}
                  className={fieldClass(false)}
                  placeholder="Company registration ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  GSTIN
                </label>
                <input
                  type="text"
                  name="gstin"
                  value={formData.company.gstin}
                  onChange={handleCompanyChange}
                  className={fieldClass(false)}
                  placeholder="GSTIN"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.company.address}
                  onChange={handleCompanyChange}
                  className={fieldClass(false)}
                  placeholder="Company address"
                />
              </div>
            </div>
          </div>

          {/* Customer Details */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-800">Customer Details</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  name="customerName"
                  value={formData.customer.customerName}
                  onChange={handleCustomerChange}
                  className={fieldClass(Boolean(errors['customer.customerName']))}
                  placeholder="Customer name"
                />
                {errors['customer.customerName'] && (
                  <p className="mt-1 text-xs text-red-600">{errors['customer.customerName']}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.customer.email}
                  onChange={handleCustomerChange}
                  className={fieldClass(Boolean(errors['customer.email']))}
                  placeholder="customer@example.com"
                />
                {errors['customer.email'] && (
                  <p className="mt-1 text-xs text-red-600">{errors['customer.email']}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.customer.phone}
                  onChange={handleCustomerChange}
                  className={fieldClass(false)}
                  placeholder="Phone number"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Bill To Company Name
                  </label>
                  <input
                    type="text"
                    value={formData.customer.billTo.companyName}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        customer: {
                          ...prev.customer,
                          billTo: { ...prev.customer.billTo, companyName: e.target.value },
                        },
                      }))
                    }
                    className={fieldClass(false)}
                    placeholder="Bill to company name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    State
                  </label>
                  <select
                    value={formData.customer.billTo.state}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        customer: {
                          ...prev.customer,
                          billTo: { ...prev.customer.billTo, state: e.target.value },
                        },
                      }))
                    }
                    className={fieldClass(false)}
                  >
                    <option value="">Select state</option>
                    {indianStates.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Ship To Company Name
                </label>
                <input
                  type="text"
                  value={formData.customer.shipTo.companyName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      customer: {
                        ...prev.customer,
                        shipTo: { ...prev.customer.shipTo, companyName: e.target.value },
                      },
                    }))
                  }
                  className={fieldClass(false)}
                  placeholder="Ship to company name"
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">Line Items</h3>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-2 rounded bg-sky-500 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-sky-600"
              >
                <Plus className="size-4" />
                Add Item
              </button>
            </div>

            {errors.items && (
              <p className="mb-4 text-sm text-red-600">{errors.items}</p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">#</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Product Code</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Product Name</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700">Qty</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Unit Price</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700">Discount %</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Line Total</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index} className="border-b border-slate-200">
                      <td className="px-4 py-3">{item.lineNumber}</td>
                      <td className="px-4 py-3">
                        <select
                          value={item.productCode}
                          onChange={(e) => handleItemChange(index, 'productCode', e.target.value)}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-sky-500 focus:outline-none"
                        >
                          <option value="">Select code</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.productCode}>
                              {product.productCode}
                            </option>
                          ))}
                        </select>
                        {item.unitMeasurements ? (
                          <p className="mt-1 text-[11px] text-slate-500">Units: {item.unitMeasurements}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={item.productName}
                          onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-sky-500 focus:outline-none"
                        >
                          <option value="">Select product</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.productName}>
                              {product.productName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs text-right focus:border-sky-500 focus:outline-none"
                          placeholder="1"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs text-right focus:border-sky-500 focus:outline-none"
                          placeholder="0"
                        />
                        {item.productCode ? (
                          <p className="mt-1 text-[11px] text-emerald-600">Sale Price auto-filled</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.discountPercent}
                          onChange={(e) => handleItemChange(index, 'discountPercent', e.target.value)}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs text-center focus:border-sky-500 focus:outline-none"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        ₹{item.lineTotal.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="rounded p-1 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="size-4 text-red-600" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Commercials */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-800">Commercial Terms</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Shipping Charges
                </label>
                <input
                  type="text"
                  value={formData.commercials.shippingCharges}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      commercials: { ...prev.commercials, shippingCharges: e.target.value },
                    }))
                  }
                  className={fieldClass(false)}
                  placeholder="At actuals"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Delivery Schedule
                </label>
                <select
                  value={formData.commercials.deliverySchedule}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      commercials: { ...prev.commercials, deliverySchedule: e.target.value },
                    }))
                  }
                  className={fieldClass(false)}
                >
                  <option value="">Select delivery schedule</option>
                  <option value="1 Week" selected>1 Week</option>
                  <option value="1~2 Weeks">1~2 Weeks</option>
                  <option value="2~3 Weeks">2~3 Weeks</option>
                  <option value="3~4 Weeks">3~4 Weeks</option>
                  <option value="4~5 Weeks">4~5 Weeks</option>
                  <option value="6~8 Weeks">6~8 Weeks</option>
                  <option value="8~10 Weeks">8~10 Weeks</option>
                  <option value="10~12 Weeks">10~12 Weeks</option>
                  <option value="12 ~18 Weeks">12 ~18 Weeks</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Payment Terms
                </label>
                <input
                  type="text"
                  value={formData.commercials.paymentTerms}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      commercials: { ...prev.commercials, paymentTerms: e.target.value },
                    }))
                  }
                  className={fieldClass(false)}
                  placeholder="e.g., 50% advance"
                />
              </div>
            </div>
          </div>

          {/* Taxes and Totals */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-800">Tax & Totals</h3>

            <div className="mt-6 space-y-2 border-t border-slate-200 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-700">Subtotal:</span>
                <span className="font-medium text-slate-900">₹{totals.subTotal.toLocaleString('en-IN')}</span>
              </div>
              {totals.isKarnataka ? (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-700">GST ({formData.taxes.gstPercentage}%):</span>
                  <span className="font-medium text-slate-900">₹{totals.gstAmount.toLocaleString('en-IN')}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700">CGST (9%):</span>
                    <span className="font-medium text-slate-900">₹{totals.cgstAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700">SGST (9%):</span>
                    <span className="font-medium text-slate-900">₹{totals.sgstAmount.toLocaleString('en-IN')}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
                <span className="text-slate-800">Grand Total:</span>
                <span className="text-slate-900">₹{totals.grandTotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="mt-4 rounded bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-600 uppercase">Amount in words</p>
                <p className="mt-1 text-sm text-slate-900">{totals.amountInWords}</p>
              </div>
            </div>
          </div>

          {/* Bank Details */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-800">Bank Details</h3>
            <p className="mb-4 text-sm text-slate-500">This section is read-only.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  value={formData.bankDetails.accountName}
                  readOnly
                  className={`${fieldClass(false)} cursor-not-allowed bg-slate-100`}
                  placeholder="Account holder name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={formData.bankDetails.bankName}
                  readOnly
                  className={`${fieldClass(false)} cursor-not-allowed bg-slate-100`}
                  placeholder="Bank name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Account Number
                </label>
                <input
                  type="text"
                  value={formData.bankDetails.accountNumber}
                  readOnly
                  className={`${fieldClass(false)} cursor-not-allowed bg-slate-100`}
                  placeholder="Account number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Branch Address
                </label>
                <input
                  type="text"
                  value={formData.bankDetails.branchAddress}
                  readOnly
                  className={`${fieldClass(false)} cursor-not-allowed bg-slate-100`}
                  placeholder="Branch address"
                />
              </div>
            </div>
          </div>

          {/* Signature and Status */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-800">Signature & Status</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Authorized Person
                </label>
                <input
                  type="text"
                  value={formData.signature.authorizedPerson}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      signature: { ...prev.signature, authorizedPerson: e.target.value },
                    }))
                  }
                  className={`${fieldClass(false)} cursor-not-allowed bg-slate-100`}
                  placeholder="Authorized person name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                  className={fieldClass(false)}
                >
                  <option value="Pending">Pending</option>
                  <option value="Sent">Sent</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/quotations')}
              className="rounded border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded bg-sky-500 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-sky-600 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  {isEditing ? 'Update Quotation' : 'Create Quotation'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
