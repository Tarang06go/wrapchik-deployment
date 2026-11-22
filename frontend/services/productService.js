import api from './api';
import { cachedRead, invalidateReadCache } from './readCache';

const queryKey = params => JSON.stringify(Object.entries(params || {}).sort(([left], [right]) => left.localeCompare(right)));
const invalidateAfterWrite = promise => promise.then(result => { invalidateReadCache('catalog:'); return result; });

const productService = {
  getPopularProducts: () => cachedRead('catalog:popular', () => api.get('/products/popular'), 45_000),
  getRecommendations: (userId) => userId
    ? cachedRead(`catalog:recommendations:${String(userId)}`, () => api.get('/products/recommended'), 20_000)
    : api.get('/products/recommended'),
  getFrequentlyBoughtTogether: (id) => api.get(`/products/${id}/paired`),
  getProducts: (params = {}) => {
    return cachedRead(`catalog:products:${queryKey(params)}`, () => api.get('/products', { params }), 20_000);
  },

  getProductById: (id) => {
    return cachedRead(`catalog:product:${id}`, () => api.get(`/products/${id}`), 20_000);
  },

  createProduct: (productData) => {
    return invalidateAfterWrite(api.post('/products', productData));
  },

  updateProduct: (id, productData) => {
    return invalidateAfterWrite(api.put(`/products/${id}`, productData));
  },

  toggleAvailability: (id, available) => {
    return invalidateAfterWrite(api.patch(`/products/${id}/availability`, { available }));
  },

  deleteProduct: (id) => {
    return invalidateAfterWrite(api.delete(`/products/${id}`));
  },
  invalidateCatalogueCache: () => invalidateReadCache('catalog:'),
};

export default productService;
