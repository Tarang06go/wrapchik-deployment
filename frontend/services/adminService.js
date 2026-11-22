import api from './api';
import { invalidateReadCache } from './readCache';

const saveSettings = data => api.put('/settings', data).then(result => { invalidateReadCache('catalog:settings'); return result; });

const adminService = {
  getAllOrders: (params = {}) => {
    return api.get('/admin/orders', { params });
  },

  updateOrderStatus: (id, status, rejectionReason) => {
    return api.put(`/admin/orders/${id}/status`, { status, rejectionReason });
  },
  verifyPickupQr: (id, token) => api.post(`/admin/orders/${id}/pickup/verify`, { token }),

  confirmCounterPayment: (orderId) => api.post('/payment/counter-confirm', { orderId }),
  getPendingUpiPayments: () => api.get('/payment/upi/pending'),
  reviewUpiPayment: (paymentId, action, reason) => api.post(`/payment/upi/${paymentId}/review`, { action, reason }),
  getPendingGroupContributions: () => api.get('/groups/admin/contributions/pending'),
  reviewGroupContribution: (groupId, contributionId, action, reason) => api.post(`/groups/${groupId}/contributions/${contributionId}/review`, { action, reason }),
  reconcileGroupPayment: (groupId) => api.post(`/groups/admin/${groupId}/reconcile-payment`),

  getAnalytics: (params = {}) => {
    return api.get('/admin/analytics', { params });
  },
  getSettings: () => api.get('/settings'),
  getCustomers: (params = {}) => api.get('/admin/customers', { params }),
  setCustomerActive: (id, isActive) => api.patch(`/admin/customers/${id}/status`, { isActive }),

  updateSettings: saveSettings,
};

export default adminService;
