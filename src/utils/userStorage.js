import { apiRequest } from './api';

const API_BASE = '/api/users';

export const getUsers = () => apiRequest(API_BASE);

export const getUserById = (id) => apiRequest(`${API_BASE}/${id}`);

export const createUser = (user) =>
  apiRequest(API_BASE, {
    method: 'POST',
    body: JSON.stringify(user),
  });

export const updateUser = (id, user) =>
  apiRequest(`${API_BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(user),
  });

export const deleteUser = (id) =>
  apiRequest(`${API_BASE}/${id}`, { method: 'DELETE' });

export const loginUser = (username, password) =>
  apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

export const getUsersSummary = (users) => ({
  total: users.length,
  admins: users.filter((u) => u.role?.toLowerCase() === 'admin').length,
  standard: users.filter((u) => u.role?.toLowerCase() !== 'admin').length,
});
