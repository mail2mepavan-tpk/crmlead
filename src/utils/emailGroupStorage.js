import { apiRequest } from './api';

const API_BASE = '/api/email-groups';

export const getEmailGroups = () => apiRequest(API_BASE);

export const getEmailGroupById = (id) => apiRequest(`${API_BASE}/${id}`);

export const createEmailGroup = (group) =>
  apiRequest(API_BASE, {
    method: 'POST',
    body: JSON.stringify(group),
  });

export const updateEmailGroup = (id, group) =>
  apiRequest(`${API_BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(group),
  });

export const deleteEmailGroup = (id) =>
  apiRequest(`${API_BASE}/${id}`, { method: 'DELETE' });

export const getEmailGroupsSummary = (items) => ({
  total: items.length,
});
