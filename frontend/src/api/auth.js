import axios from 'axios';

const API_URL = 'http://localhost:5000/api/auth';

/* =============================
   LOGIN
============================= */

export const loginUser = async (credentials) => {
  return await axios.post(`${API_URL}/login`, credentials);
};


/* =============================
   REGISTER
============================= */

export const registerUser = async (userData) => {
  return await axios.post(`${API_URL}/register`, userData);
};


/* =============================
   VERIFY OTP
============================= */

export const verifyOTP = async (data) => {
  return await axios.post(`${API_URL}/verify-email`, data);
};


/* =============================
   RESEND OTP
============================= */

export const resendOTP = async (data) => {
  return await axios.post(`${API_URL}/resend-verification`, data);
};


/* =============================
   UPDATE PHONE
============================= */

export const updatePhone = async (phone, token) => {
  return await axios.patch(
    `${API_URL}/update-phone`,
    { phone },
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
};