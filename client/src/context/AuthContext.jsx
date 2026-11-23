import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api.js';

const AuthContext = createContext(null);

export const getDashboardPathForRole = (role) => {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'recruiter':
      return '/recruiter/dashboard';
    case 'candidate':
    default:
      return '/candidate/dashboard';
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('adaptiq_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('adaptiq_access_token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('adaptiq_access_token');
      if (storedToken) {
        try {
          const res = await authAPI.getMe();
          setUser(res.data.data.user);
          localStorage.setItem('adaptiq_user', JSON.stringify(res.data.data.user));
        } catch (err) {
          console.warn('Session verification failed, logging out:', err);
          logout();
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (email, password) => {
    setError(null);
    try {
      const res = await authAPI.login({ email, password });
      const { user: userData, accessToken, refreshToken } = res.data.data;

      localStorage.setItem('adaptiq_access_token', accessToken);
      localStorage.setItem('adaptiq_refresh_token', refreshToken);
      localStorage.setItem('adaptiq_user', JSON.stringify(userData));

      setUser(userData);
      setToken(accessToken);
      return userData;
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please check your credentials.';
      setError(msg);
      throw new Error(msg);
    }
  };

  const register = async (formData) => {
    setError(null);
    try {
      const res = await authAPI.register(formData);
      const { user: userData, accessToken, refreshToken } = res.data.data;

      localStorage.setItem('adaptiq_access_token', accessToken);
      localStorage.setItem('adaptiq_refresh_token', refreshToken);
      localStorage.setItem('adaptiq_user', JSON.stringify(userData));

      setUser(userData);
      setToken(accessToken);
      return userData;
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.';
      setError(msg);
      throw new Error(msg);
    }
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('adaptiq_refresh_token');
    try {
      if (refreshToken) {
        await authAPI.logout(refreshToken);
      }
    } catch (err) {
      console.warn('Logout notification error:', err);
    } finally {
      localStorage.removeItem('adaptiq_access_token');
      localStorage.removeItem('adaptiq_refresh_token');
      localStorage.removeItem('adaptiq_user');
      setUser(null);
      setToken(null);
    }
  };

  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated: Boolean(user && token),
    login,
    register,
    logout,
    getDashboardPath: () => getDashboardPathForRole(user?.role)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
