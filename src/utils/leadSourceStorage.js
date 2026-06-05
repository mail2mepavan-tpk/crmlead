import { apiRequest } from './api';

const API_BASE = '/api/lead-sources';

export const getLeadSources = () => apiRequest(API_BASE);

export const getLeadSourceById = (id) => apiRequest(`${API_BASE}/${id}`);

export const createLeadSource = (source) =>
  apiRequest(API_BASE, {
    method: 'POST',
    body: JSON.stringify(source),
  });

export const updateLeadSource = (id, source) =>
  apiRequest(`${API_BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(source),
  });

export const deleteLeadSource = (id) =>
  apiRequest(`${API_BASE}/${id}`, { method: 'DELETE' });

export const getLeadSourcesSummary = (items) => ({
  total: items.length,
});
