import { apiRequest } from './api';

const API_BASE = '/api/contacts';

export const getContacts = () => apiRequest(API_BASE);

export const getContactById = (id) => apiRequest(`${API_BASE}/${id}`);

export const createContact = (contact) =>
  apiRequest(API_BASE, {
    method: 'POST',
    body: JSON.stringify(contact),
  });

export const updateContact = (id, contact) =>
  apiRequest(`${API_BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(contact),
  });

export const deleteContact = (id) =>
  apiRequest(`${API_BASE}/${id}`, { method: 'DELETE' });

export const getContactsSummary = (contacts) => ({
  total: contacts.length,
  active: contacts.filter((item) => item.status === 'Active').length,
  inactive: contacts.filter((item) => item.status === 'In-Active').length,
});
