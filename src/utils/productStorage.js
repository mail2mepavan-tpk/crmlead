import { apiRequest } from './api';

const API_BASE = '/api/products';

export const getProducts = () => apiRequest(API_BASE);

export const getProductById = (id) => apiRequest(`${API_BASE}/${id}`);

export const createProduct = (product) =>
  apiRequest(API_BASE, {
    method: 'POST',
    body: JSON.stringify(product),
  });

export const updateProduct = (id, product) =>
  apiRequest(`${API_BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(product),
  });

export const deleteProduct = (id) =>
  apiRequest(`${API_BASE}/${id}`, { method: 'DELETE' });

export const getProductsSummary = (products) => ({
  total: products.length,
});
