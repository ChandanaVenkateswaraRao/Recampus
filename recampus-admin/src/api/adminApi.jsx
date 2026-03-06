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
export const fetchAdminItems = ({ status = 'all', search = '', page = 1, limit = 15 } = {}) =>
  API.get('/items/admin/list', { params: { status, search, page, limit } });
export const adminDeleteItem = (id) => API.delete(`/items/admin/delete/${id}`);
export const addHouse = (houseData) => API.post('/houses/add', houseData);
export const fetchAdminHouses = ({ search = '', status = 'all', page = 1, limit = 10 } = {}) =>
  API.get('/houses/admin/list', { params: { search, status, page, limit } });
export const adminUpdateHouse = (houseId, payload) => API.patch(`/houses/admin/update/${houseId}`, payload);
export const adminRestoreHouse = (houseId) => API.patch(`/houses/admin/restore/${houseId}`);
export const adminDeleteHouse = (houseId) => API.delete(`/houses/admin/delete/${houseId}`);
export const fetchRideCancellationAnalytics = (days = 30) =>
  API.get(`/rides/cancellation-analytics/admin?days=${days}`);

export const fetchHouseUnlockSummary = (days = 30) =>
  API.get('/admin/houses/unlock-summary', { params: { days } });

export const fetchRideMonitorData = ({ status = 'active', search = '', page = 1, limit = 20, criticalOnly = false } = {}) =>
  API.get('/admin/rides/monitor', {
    params: { status, search, page, limit, criticalOnly }
  });

export const fetchRideSettlementSummary = (days = 30) =>
  API.get('/admin/rides/settlement-summary', { params: { days } });

export const fetchRideDisputes = ({ status = 'open', search = '', page = 1, limit = 20 } = {}) =>
  API.get('/admin/rides/disputes', { params: { status, search, page, limit } });

export const resolveRideDispute = (rideId, payload) =>
  API.patch(`/admin/rides/${rideId}/dispute/resolve`, payload);

export const forceCancelRide = (rideId, reason) =>
  API.patch(`/admin/rides/${rideId}/force-cancel`, { reason });

export const requeueRide = (rideId) =>
  API.patch(`/admin/rides/${rideId}/requeue`);

export const bulkForceCancelRides = (rideIds, reason) =>
  API.patch('/admin/rides/bulk/force-cancel', { rideIds, reason });

export const bulkRequeueRides = (rideIds, note) =>
  API.patch('/admin/rides/bulk/requeue', { rideIds, note });