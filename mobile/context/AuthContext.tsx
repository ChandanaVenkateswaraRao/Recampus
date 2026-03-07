import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '@/constants/api';
import { api } from '@/lib/api';
import { clearToken, getToken, saveToken } from '@/lib/storage';

type User = {
  _id?: string;
  id?: string;
  email?: string;
  phone?: string;
  roles?: string[];
  walletBalance?: number;
};

type RegisterPayload = {
  email: string;
  password: string;
  phone: string;
};

type AuthContextType = {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!token) return;
    const res = await api.get('/auth/profile');
    setUser(res.data || null);
  }, [token]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const storedToken = await getToken();
        if (!storedToken) {
          setLoading(false);
          return;
        }

        setToken(storedToken);
        const res = await axios.get(`${API_BASE_URL}/auth/profile`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        setUser(res.data || null);
      } catch (_) {
        await clearToken();
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await axios.post(`${API_BASE_URL}/auth/login`, { email, password });
    const nextToken = String(res.data?.token || '');
    if (!nextToken) {
      throw new Error('Login failed. Missing token.');
    }

    await saveToken(nextToken);
    setToken(nextToken);
    setUser(res.data?.user || null);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const res = await axios.post(`${API_BASE_URL}/auth/register`, payload);
    const nextToken = String(res.data?.token || '');
    if (!nextToken) {
      throw new Error('Registration failed. Missing token.');
    }

    await saveToken(nextToken);
    setToken(nextToken);
    setUser(res.data?.user || null);
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ token, user, loading, login, register, logout, refreshProfile }),
    [token, user, loading, login, register, logout, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return context;
};
