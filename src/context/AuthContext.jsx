import { createContext, useContext, useState, useEffect } from 'react';
import { loginUser } from '../utils/userStorage';
import { apiRequest } from '../utils/api';

const AuthContext = createContext(null);
const SESSION_KEY = 'crm_current_user';

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    } finally {
      setReady(true);
    }
  }, []);

  const login = async (username, password) => {
    const user = await loginUser(username, password);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    setCurrentUser(user);
    return user;
  };

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore errors - still clear session locally
    }
    sessionStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
  };

  const updateSessionUser = (user) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    setCurrentUser(user);
  };

  const isAdmin = currentUser?.role?.toLowerCase() === 'admin';
  const isDirector = currentUser?.role?.toLowerCase() === 'director';
  const isSalesManager = currentUser?.role?.toLowerCase() === 'manager';

  return (
    <AuthContext.Provider
      value={{ currentUser, ready, login, logout, updateSessionUser, isAdmin, isDirector, isSalesManager }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
