import api from './api';

const orderService = {
  createOrder: (orderPayload) => {
    return api.post('/orders', orderPayload);
  },

  getMyOrders: (params) => api.get('/orders/my', params ? { params } : undefined),
  getHomeOrderSummary: () => api.get('/orders/my', { params: { homeSummary: 'true' } }),
  getReadyPickupOrders: () => api.get('/orders/my', { params: { readyPickup: 'true' } }),

  getOrderById: (id) => {
    return api.get(`/orders/${id}`);
  },
  getPickupQr: (id, groupOrderId = null) => api.post(`/orders/${id}/pickup-qr`, groupOrderId ? { groupOrderId: String(groupOrderId?._id || groupOrderId) } : {}),

  cancelOrder: (id) => {
    return api.post(`/orders/${id}/cancel`);
  },
  reorderFromPast: (orderId) => {
    return api.post(`/orders/${orderId}/reorder`);
  }
};

export default orderService;
