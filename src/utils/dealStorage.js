import { apiRequest } from './api';

const API_BASE = '/api/deals';

export const getDeals = () => apiRequest(API_BASE);
export const getDealById = (id) => apiRequest(`${API_BASE}/${id}`);

export const createDeal = (deal) =>
  apiRequest(API_BASE, {
    method: 'POST',
    body: JSON.stringify(deal),
  });

export const updateDeal = (id, deal) =>
  apiRequest(`${API_BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(deal),
  });

export const deleteDeal = (id) =>
  apiRequest(`${API_BASE}/${id}`, { method: 'DELETE' });

export const getDealsSummary = (items) => ({
  total: items.length,
});
