// Utility functions for managing enquiries in localStorage

export const STORAGE_KEY = 'enquiries';

// Get all enquiries from localStorage
export const getEnquiries = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error reading enquiries:', error);
    return [];
  }
};

// Save new enquiry
export const saveEnquiry = (enquiry) => {
  try {
    const enquiries = getEnquiries();
    const newEnquiry = {
      id: Date.now(),
      ...enquiry,
      createdAt: new Date().toISOString(),
    };
    enquiries.push(newEnquiry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(enquiries));
    return newEnquiry;
  } catch (error) {
    console.error('Error saving enquiry:', error);
    return null;
  }
};

// Update enquiry
export const updateEnquiry = (id, updatedData) => {
  try {
    const enquiries = getEnquiries();
    const index = enquiries.findIndex((e) => e.id === id);
    if (index !== -1) {
      enquiries[index] = { ...enquiries[index], ...updatedData };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(enquiries));
      return enquiries[index];
    }
    return null;
  } catch (error) {
    console.error('Error updating enquiry:', error);
    return null;
  }
};

// Delete enquiry
export const deleteEnquiry = (id) => {
  try {
    const enquiries = getEnquiries();
    const filtered = enquiries.filter((e) => e.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting enquiry:', error);
    return false;
  }
};

// Export enquiries as JSON
export const exportEnquiries = () => {
  const enquiries = getEnquiries();
  const dataStr = JSON.stringify(enquiries, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `enquiries_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

// Import enquiries from JSON file
export const importEnquiries = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (Array.isArray(data)) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          resolve(data);
        } else {
          reject(new Error('Invalid JSON format'));
        }
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
};

// Get summary statistics
export const getEnquiriesSummary = () => {
  const enquiries = getEnquiries();
  return {
    total: enquiries.length,
    today: enquiries.filter(
      (e) =>
        new Date(e.date).toDateString() === new Date().toDateString()
    ).length,
    thisMonth: enquiries.filter(
      (e) =>
        new Date(e.date).getMonth() === new Date().getMonth() &&
        new Date(e.date).getFullYear() === new Date().getFullYear()
    ).length,
  };
};
