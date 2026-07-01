import { apiRequest } from './api';

const API_BASE = '/api/quotes';

export const getQuotes = () => apiRequest(API_BASE);

export const getQuoteById = (id) => apiRequest(`${API_BASE}/${id}`);

export const createQuote = (quote) =>
  apiRequest(API_BASE, {
    method: 'POST',
    body: JSON.stringify(quote),
  });

export const updateQuote = (id, quote) =>
  apiRequest(`${API_BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(quote),
  });

export const deleteQuote = (id) =>
  apiRequest(`${API_BASE}/${id}`, { method: 'DELETE' });

export const generateQuotePDF = async (quoteId) => {
  const stored = sessionStorage.getItem('crm_current_user');
  const headers = {};
  if (stored) {
    const user = JSON.parse(stored);
    headers['X-User-Id'] = String(user.id);
    headers['X-User-Role'] = user.role;
  }

  const response = await fetch(`${API_BASE}/${quoteId}/pdf`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to generate PDF (${response.status})`);
  }

  return response;
};

export const sendQuoteEmail = (quoteId, recipients) =>
  apiRequest(`${API_BASE}/${quoteId}/send-email`, {
    method: 'POST',
    body: JSON.stringify({ recipients }),
  });

export const getQuotesSummary = (quotes) => ({
  total: quotes.length,
  pending: quotes.filter((q) => q.status === 'Pending').length,
  sent: quotes.filter((q) => q.status === 'Sent').length,
  accepted: quotes.filter((q) => q.status === 'Accepted').length,
  rejected: quotes.filter((q) => q.status === 'Rejected').length,
});

export const calculateLineTotal = (quantity, unitPrice, discountPercent) => {
  const discountAmount = (unitPrice * quantity * discountPercent) / 100;
  return quantity * unitPrice - discountAmount;
};

export const calculateGST = (subtotal, gstPercentage) => {
  return (subtotal * gstPercentage) / 100;
};

export const calculateGrandTotal = (subtotal, gstAmount, shippingCharges = 0) => {
  return subtotal + gstAmount + shippingCharges;
};

export const numberToWords = (num) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertBelowHundred = (n) => {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  };

  const convert = (n) => {
    if (n === 0) return '';
    if (n < 100) return convertBelowHundred(n);
    if (n < 1000) {
      const hundredPart = ones[Math.floor(n / 100)];
      const remainder = n % 100;
      return remainder ? `${hundredPart} Hundred ${convert(remainder)}` : `${hundredPart} Hundred`;
    }
    if (n < 100000) {
      const thousandPart = Math.floor(n / 1000);
      const remainder = n % 1000;
      return remainder ? `${convert(thousandPart)} Thousand ${convert(remainder)}` : `${convert(thousandPart)} Thousand`;
    }
    if (n < 10000000) {
      const lakhPart = Math.floor(n / 100000);
      const remainder = n % 100000;
      return remainder ? `${convert(lakhPart)} Lakh ${convert(remainder)}` : `${convert(lakhPart)} Lakh`;
    }

    const crorePart = Math.floor(n / 10000000);
    const remainder = n % 10000000;
    return remainder ? `${convert(crorePart)} Crore ${convert(remainder)}` : `${convert(crorePart)} Crore`;
  };

  const value = Math.trunc(Number(num));
  if (!Number.isFinite(value) || value < 0) return 'Invalid amount';
  if (value === 0) return 'Zero Rupees';

  return `${convert(value).trim()} Rupees`;
};
