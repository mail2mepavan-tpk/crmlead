import { apiRequest } from './api';

const API_BASE = '/api/sales-leads';

export const getSalesLeads = () => apiRequest(API_BASE);
export const getSalesLeadById = (id) => apiRequest(`${API_BASE}/${id}`);

export const createSalesLead = (lead) =>
  apiRequest(API_BASE, {
    method: 'POST',
    body: JSON.stringify(lead),
  });

export const updateSalesLead = (id, lead) =>
  apiRequest(`${API_BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(lead),
  });

export const deleteSalesLead = (id) =>
  apiRequest(`${API_BASE}/${id}`, { method: 'DELETE' });

export const getSalesLeadsSummary = (items) => ({
  total: items.length,
});
