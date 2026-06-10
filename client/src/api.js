import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── API functions ───────────────────────────────────
export const fetchAccounts = () => api.get('/accounts');
export const fetchTransactions = () => api.get('/transactions');
export const fetchAuditLog = () => api.get('/audit-log');
export const fetchMeshState = () => api.get('/mesh/state');
export const fetchServerKey = () => api.get('/server-key');

export const sendPayment = (data) => api.post('/demo/send', data);
export const gossipMesh = () => api.post('/mesh/gossip');
export const flushBridges = () => api.post('/mesh/flush');
export const resetMesh = () => api.post('/mesh/reset');

export default api;
