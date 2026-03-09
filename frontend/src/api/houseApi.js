import axios from 'axios';

const API_URL = 'https://recampus-backend.onrender.com/api/houses';

const getHeaders = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  }
});

export const fetchHouses = () => axios.get(`${API_URL}/browse`, getHeaders());

export const toggleHouseLike = (houseId) =>
  axios.post(`${API_URL}/like/${houseId}`, {}, getHeaders());

export const payForHouseUnlock = (houseId, payload = {}) =>
  axios.post(`${API_URL}/pay/${houseId}`, payload, getHeaders());

export const unlockHouseOwnerContact = (houseId) =>
  payForHouseUnlock(houseId, { method: 'simulated' });
