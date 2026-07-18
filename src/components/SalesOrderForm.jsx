import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Plus, Trash2, X } from 'lucide-react';
import {
  createSalesOrder,
  updateSalesOrder,
  getSalesOrderById,
  calculateLineTotal,
  calculateGST,
  calculateGrandTotal,
  numberToWords,
} from '../utils/salesOrderStorage';
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

const emptyOrder = () => ({
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
  salesOrder: {
    salesOrderNumber: 'AAR-WEB-2' + Math.floor(10000 + Math.random() * 90000),
    orderType: 'Initial',
    salesOrderDate: new Date().toISOString().split('T')[0],
    deliveryDate: '',
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

export default function SalesOrderForm() {
  const navigate = useNavigate();
  const { id, dealId } = useParams();
  const isEditing = Boolean(id);
  const { currentUser } = useAuth();

  const [formData, setFormData] = useState(emptyOrder);
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
        const order = await getSalesOrderById(id);
        if (!cancelled) {
          setFormData(order);
          setItems(order.items || []);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError('Could not load sales order. It may have been deleted.');
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

  const handleSalesOrderChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      salesOrder: { ...prev.salesOrder, [name]: value },
    }));
    if (errors[`salesOrder.${name}`]) {
      setErrors((prev) => ({ ...prev, [`salesOrder.${name}`]: '' }));
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
    if (!formData.salesOrder.salesOrderNumber.trim()) {
      newErrors['salesOrder.salesOrderNumber'] = 'Order number is required';
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
        await updateSalesOrder(id, payload);
      } else {
        await createSalesOrder(payload);
      }
      navigate('/sales-orders');
    } catch (err) {
      setErrors({ submit: err.message || 'Error saving sales order' });
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
            {isEditing ? 'Edit Sales Order' : 'Create New Sales Order'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isEditing ? 'Update sales order details' : 'Create a new sales order with line items and pricing'}
          </p>
        </div>

        {errors.submit && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errors.submit}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Order Details */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-800">Sales Order Details - Deal # {dealId}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Order Number *
                </label>
                <input
                  type="text"
                  name="salesOrderNumber"
                  value={formData.salesOrder.salesOrderNumber}
                  onChange={handleSalesOrderChange}
                  className={fieldClass(Boolean(errors['salesOrder.salesOrderNumber']))}
                  placeholder="e.g., AAR-WEB-212345"
                />
                {errors['salesOrder.salesOrderNumber'] && (
                  <p className="mt-1 text-xs text-red-600">{errors['salesOrder.salesOrderNumber']}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Order Type
                </label>
                <select
                  name="orderType"
                  value={formData.salesOrder.orderType}
                  onChange={handleSalesOrderChange}
                  className={fieldClass(false)}
                >
                  <option>Initial</option>
                  <option>Revised</option>
                  <option>Final</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Order Date
                </label>
                <input
                  type="date"
                  name="salesOrderDate"
                  value={formData.salesOrder.salesOrderDate}
                  onChange={handleSalesOrderChange}
                  className={fieldClass(false)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Delivery Date
                </label>
                <input
                  type="date"
                  name="deliveryDate"
                  value={formData.salesOrder.deliveryDate}
                  onChange={handleSalesOrderChange}
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
                  value={formData.salesOrder.placeOfSupply}
                  onChange={handleSalesOrderChange}
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
                  value={formData.salesOrder.reference}
                  onChange={handleSalesOrderChange}
                  className={fieldClass(false)}
                  placeholder="e.g., Visit"
                />
              </div>
            </div>
          </div>

          {/* Customer & Items */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-800">Customer & Items</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  name="customerName"
                  value={formData.customer.customerName}
                  onChange={handleCustomerChange}
                  className={fieldClass(Boolean(errors['customer.customerName']))}
                />
                {errors['customer.customerName'] && (
                  <p className="mt-1 text-xs text-red-600">{errors['customer.customerName']}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.customer.email}
                  onChange={handleCustomerChange}
                  className={fieldClass(Boolean(errors['customer.email']))}
                />
                {errors['customer.email'] && (
                  <p className="mt-1 text-xs text-red-600">{errors['customer.email']}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.customer.phone}
                  onChange={handleCustomerChange}
                  className={fieldClass(false)}
                />
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-800">Items</h4>
                <button type="button" onClick={addItem} className="inline-flex items-center gap-2 rounded bg-slate-100 px-3 py-1 text-sm">
                  <Plus className="size-4" /> Add Item
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {items.length === 0 && (
                  <div className="text-sm text-slate-500">No items added</div>
                )}
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-12 items-end">
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-slate-600 mb-1">Product</label>
                      <select value={item.productCode} onChange={(e) => handleItemChange(idx, 'productCode', e.target.value)} className={fieldClass(false)}>
                        <option value="">Select product</option>
                        {products.map((p) => (
                          <option key={p.productCode} value={p.productCode}>{p.productName}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs text-slate-600 mb-1">Description</label>
                      <input type="text" value={item.description} onChange={(e) => handleItemChange(idx, 'description', e.target.value)} className={fieldClass(false)} />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-xs text-slate-600 mb-1">Qty</label>
                      <input type="number" value={item.quantity} onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)} className={fieldClass(false)} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-slate-600 mb-1">Unit Price</label>
                      <input type="number" value={item.unitPrice} onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)} className={fieldClass(false)} />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-xs text-slate-600 mb-1">Discount %</label>
                      <input type="number" value={item.discountPercent} onChange={(e) => handleItemChange(idx, 'discountPercent', e.target.value)} className={fieldClass(false)} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-slate-600 mb-1">Line Total</label>
                      <div className="text-sm font-medium">₹{item.lineTotal?.toLocaleString('en-IN')}</div>
                    </div>
                    <div className="sm:col-span-1 text-right">
                      <button type="button" onClick={() => removeItem(idx)} className="rounded p-2 hover:bg-slate-100">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>

          {/* Totals & Bank */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Shipping Charges</label>
                <input type="text" value={formData.commercials.shippingCharges} onChange={(e) => setFormData(prev => ({ ...prev, commercials: { ...prev.commercials, shippingCharges: e.target.value } }))} className={fieldClass(false)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">GST %</label>
                <input type="number" value={formData.taxes.gstPercentage} onChange={(e) => setFormData(prev => ({ ...prev, taxes: { ...prev.taxes, gstPercentage: Number(e.target.value) } }))} className={fieldClass(false)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select value={formData.status} onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))} className={fieldClass(false)}>
                  <option>Pending</option>
                  <option>Sent</option>
                  <option>Accepted</option>
                  <option>Rejected</option>
                </select>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">Subtotal</p>
                <p className="text-lg font-semibold">₹{totals.subTotal?.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">GST</p>
                <p className="text-lg font-semibold">₹{totals.gstAmount?.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Grand Total</p>
                <p className="text-lg font-semibold">₹{totals.grandTotal?.toLocaleString('en-IN')}</p>
              </div>
            </div>

            <div className="mt-6 text-right">
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded bg-sky-500 px-4 py-2 text-sm font-semibold text-white">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} {isEditing ? 'Save Changes' : 'Create Order'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
