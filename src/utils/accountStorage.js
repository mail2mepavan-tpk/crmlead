import { apiRequest } from './api';

const API_BASE = '/api/accounts';

export const getAccounts = () => apiRequest(API_BASE);

export const getAccountById = (id) => apiRequest(`${API_BASE}/${id}`);

export const createAccount = (account) =>
  apiRequest(API_BASE, {
    method: 'POST',
    body: JSON.stringify(account),
  });

export const updateAccount = (id, account) =>
  apiRequest(`${API_BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(account),
  });

export const deleteAccount = (id) =>
  apiRequest(`${API_BASE}/${id}`, { method: 'DELETE' });

export const getAccountsSummary = (accounts) => ({
  total: accounts.length,
  active: accounts.filter((item) => item.status === 'Active').length,
  inactive: accounts.filter((item) => item.status === 'In-Active').length,
  pending: accounts.filter((item) => item.status === 'Pending').length,
  underReview: accounts.filter((item) => item.status === 'Under-Review').length,
});
