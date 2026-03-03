import axios from 'axios';

const API = axios.create({ baseURL: 'http://localhost:5000/api' });

// Add token to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const fetchPendingItems = () => API.get('/items/admin/pending'); // You'll need this backend route
export const moderateItem = (id, data) => API.patch(`/items/admin/validate/${id}`, data);
export const addHouse = (houseData) => API.post('/houses/add', houseData);