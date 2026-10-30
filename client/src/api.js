import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api'
});

api.interceptors.request.use((c) => {
  const t = localStorage.getItem('token');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

export const toast = (msg, type = 'ok') =>
  window.dispatchEvent(new CustomEvent('toast', { detail: { msg, type } }));

export const err = (e) =>
  toast(e.response?.data?.message || 'Something went wrong', 'bad');

export default api;
