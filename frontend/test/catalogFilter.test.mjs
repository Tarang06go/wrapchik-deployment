import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCatalogueProducts } from '../utils/catalogFilter.js';

const products = [
  { _id: 'veg', name: 'Paneer Wrap', price: 80, categoryId: 'wraps', isVeg: true },
  { _id: 'nonveg', name: 'Chicken Wrap', price: 110, categoryId: { _id: 'wraps' }, isVeg: false },
  { _id: 'unknown', name: 'Special Wrap', price: 90, category: { _id: 'wraps' }, isVeg: null },
  { _id: 'other', name: 'Paneer Burger', price: 120, categoryId: 'burgers', isVeg: true },
];

test('combined search/category/price filters preserve genuinely matching products', () => {
  const result = filterCatalogueProducts(products, { search: 'wrap', category: 'wraps', priceRange: 'UNDER_100' });
  assert.deepEqual(result.map(item => item._id), ['veg', 'unknown']);
});

test('diet filters do not treat unknown classification as vegetarian or non-vegetarian', () => {
  assert.deepEqual(filterCatalogueProducts(products, { diet: 'VEG' }).map(item => item._id).sort(), ['other', 'veg']);
  assert.deepEqual(filterCatalogueProducts(products, { diet: 'NON_VEG' }).map(item => item._id), ['nonveg']);
});

test('search is case-insensitive, returns every match, and applies the selected price and category filters', () => {
  const result = filterCatalogueProducts(products, {
    search: 'WRAP', category: 'wraps', priceRange: '100_200', sort: { field: 'price', order: 'asc' },
  });
  assert.deepEqual(result.map(item => item._id), ['nonveg']);
  assert.deepEqual(filterCatalogueProducts(products, { search: 'wrap' }).map(item => item._id).sort(), ['nonveg', 'unknown', 'veg']);
  assert.deepEqual(filterCatalogueProducts(products, { search: 'pizza' }), []);
});

test('keystroke search can preserve the catalogue order without sorting the filtered result', () => {
  const sorted = filterCatalogueProducts(products, { sort: { field: 'name', order: 'asc' } });
  const matches = filterCatalogueProducts(sorted, { search: 'wrap', sort: null });
  assert.deepEqual(matches.map(item => item._id), ['nonveg', 'veg', 'unknown']);
});
