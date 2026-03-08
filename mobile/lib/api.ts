// Email verification API
export async function verifyEmail(email: string, code: string) {
  return api.post('/auth/verify-email', { email, code });
}
import axios from 'axios';
import { API_BASE_URL } from '@/constants/api';
import { getToken } from '@/lib/storage';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
