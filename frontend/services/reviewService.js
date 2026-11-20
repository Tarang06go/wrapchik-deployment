import api from './api';

const reviewService = {
  getForOrder: orderId => api.get(`/reviews/${orderId}`),
  createForOrder: (orderId, data) => api.post(`/reviews/${orderId}`, data),
};

export default reviewService;
