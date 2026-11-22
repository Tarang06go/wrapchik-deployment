import api from './api';
import { cachedRead } from './readCache';

const settingsService = {
  getSettings: () => cachedRead('catalog:settings', () => api.get('/settings'), 12_000),
};

export default settingsService;
