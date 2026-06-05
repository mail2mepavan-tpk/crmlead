import { apiRequest } from './api';

const API_BASE = '/api/sales-regions';

export const getSalesRegions = () => apiRequest(API_BASE);

export const getSalesRegionById = (id) => apiRequest(`${API_BASE}/${id}`);

export const createSalesRegion = (region) =>
  apiRequest(API_BASE, {
    method: 'POST',
    body: JSON.stringify(region),
  });

export const updateSalesRegion = (id, region) =>
  apiRequest(`${API_BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(region),
  });

export const deleteSalesRegion = (id) =>
  apiRequest(`${API_BASE}/${id}`, { method: 'DELETE' });

export const getSalesRegionsSummary = (items) => ({
  total: items.length,
});
