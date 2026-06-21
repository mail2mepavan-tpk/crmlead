import { apiRequest } from './api';

const API_BASE = '/api/enquiries';
const LEGACY_STORAGE_KEY = 'enquiries';

async function migrateFromLocalStorage() {
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacy) {
    return;
  }

  try {
    const data = JSON.parse(legacy);
    if (Array.isArray(data) && data.length > 0) {
      await apiRequest(API_BASE, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to migrate enquiries from localStorage:', error);
  }
}

export const getEnquiries = async () => {
  const enquiries = await apiRequest(API_BASE);
  if (enquiries.length === 0) {
    await migrateFromLocalStorage();
    return apiRequest(API_BASE);
  }
  return enquiries;
};

export const getEnquiryById = async (id) => {
  return apiRequest(`${API_BASE}/${id}`);
};

export const saveEnquiry = async (enquiry) => {
  return apiRequest(API_BASE, {
    method: 'POST',
    body: JSON.stringify(enquiry),
  });
};

export const updateEnquiry = async (id, updatedData) => {
  return apiRequest(`${API_BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updatedData),
  });
};

export const deleteEnquiry = async (id) => {
  await apiRequest(`${API_BASE}/${id}`, { method: 'DELETE' });
  return true;
};

export const replaceEnquiries = async (enquiries) => {
  return apiRequest(API_BASE, {
    method: 'PUT',
    body: JSON.stringify(enquiries),
  });
};

export const exportEnquiries = async () => {
  const enquiries = await getSalesLeads();
  const dataStr = JSON.stringify(enquiries, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `enquiries_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

export const importEnquiries = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data)) {
          reject(new Error('Invalid JSON format'));
          return;
        }
        const result = await replaceEnquiries(data);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
};

export const getEnquiriesSummary = (enquiries) => {
  const today = new Date().toDateString();
  const now = new Date();
  return {
    total: enquiries.length,
    today: enquiries.filter((e) => new Date(e.date).toDateString() === today)
      .length,
    thisMonth: enquiries.filter((e) => {
      const d = new Date(e.date);
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    }).length,
  };
};
