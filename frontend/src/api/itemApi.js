import axios from 'axios';

const API_URL = 'https://recampus-backend.onrender.com/api/items';
const getHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export const listNewItem = (data) => axios.post(`${API_URL}/list`, data, getHeaders());
export const fetchItems = () => axios.get(`${API_URL}/browse`, getHeaders());
export const initiatePurchase = (id) => axios.post(`${API_URL}/buy/${id}`, {}, getHeaders());
export const verifyHandover = (itemId, code) => axios.post(`${API_URL}/verify-handover`, { itemId, code }, getHeaders());