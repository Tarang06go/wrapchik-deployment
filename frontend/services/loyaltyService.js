import api from './api';

const loyaltyService = {
  getMine: () => api.get('/loyalty/me'),
  quote: data => api.post('/loyalty/quote', data),
};

export default loyaltyService;
