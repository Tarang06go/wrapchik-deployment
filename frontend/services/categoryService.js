import api from './api';
import { cachedRead, invalidateReadCache } from './readCache';

const changed = promise => promise.then(result => { invalidateReadCache('catalog:'); return result; });

const categoryService = {
  getCategories: () => cachedRead('catalog:categories', () => api.get('/categories'), 60_000),

  createCategory: (categoryData) => {
    return changed(api.post('/categories', categoryData));
  },

  updateCategory: (id, categoryData) => {
    return changed(api.put(`/categories/${id}`, categoryData));
  },

  deleteCategory: (id) => {
    return changed(api.delete(`/categories/${id}`));
  },
};

export default categoryService;
