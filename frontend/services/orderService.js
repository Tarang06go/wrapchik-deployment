import api from './api';

const orderService = {
  createOrder: (orderPayload) => {
    return api.post('/orders', orderPayload);
  },

  getMyOrders: () => {
    return api.get('/orders/my');
  },

  getOrderById: (id) => {
    return api.get(`/orders/${id}`);
  },
  getPickupQr: (id) => api.post(`/orders/${id}/pickup-qr`),

  cancelOrder: (id) => {
    return api.post(`/orders/${id}/cancel`);
  },
  reorderFromPast: (orderId) => {
    return api.post(`/orders/${orderId}/reorder`);
  }
};

export default orderService;
