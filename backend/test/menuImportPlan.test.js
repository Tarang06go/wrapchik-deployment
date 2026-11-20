const test = require('node:test');
const assert = require('node:assert/strict');
const manifest = require('../data/menu-import-2026-11-20.json');
const imageSources = require('../data/menu-image-sources.json');
const { normalizeMenuName, classifyFromExplicitName, planMenuImport } = require('../src/utils/menuImportPlan');

const existingCategories = [
  { _id: 'burgers', name: 'Burgers' },
  { _id: 'wraps', name: 'Wraps' },
  { _id: 'fries', name: 'Fries & Sides' },
  { _id: 'drinks', name: 'Drinks & Shakes' },
];
const existingProducts = [
  { _id: 'old-wrap', name: 'Crispy Veg Patty Wrap', price: 90, categoryName: 'Wraps', imageUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47', isVeg: true, description: 'Existing description' },
  { _id: 'old-fries', name: 'Peri Peri Masala Fries', price: 70, categoryName: 'Fries & Sides', imageUrl: 'https://existing.example/fries.jpg', isVeg: true, description: 'Existing fries' },
  { _id: 'old-burger', name: 'Classic Veg Cheese Burger', price: 80, categoryName: 'Burgers', imageUrl: 'https://existing.example/burger.jpg', isVeg: true, description: 'Existing burger' },
  { _id: 'old-coffee', name: 'Cold Coffee', price: 80, categoryName: 'Drinks & Shakes', imageUrl: 'https://existing.example/coffee.jpg', isVeg: true, description: 'Existing coffee' },
  { _id: 'old-wrap2', name: 'Paneer Tikka Wrap', price: 120, categoryName: 'Wraps', imageUrl: 'https://existing.example/paneer.jpg', isVeg: true, description: 'Existing paneer wrap' },
];

test('screenshot menu import is normalized, deduplicated and preserves ambiguous rows for review', () => {
  const plan = planMenuImport({ manifest, imageSources, existingProducts, existingCategories });
  assert.equal(manifest.products.length, 66);
  assert.equal(manifest.products.filter(row => row.status !== 'needs_review').length, 61);
  assert.equal(plan.reviewItems.filter(item => item.note.includes('truncates')).length, 5);
  assert.equal(plan.updates.length, 2);
  assert.equal(plan.creates.length, 59);
  assert.deepEqual(plan.missingCategories.map(category => category.name), ['Salads', 'Snacks']);
  assert.equal(plan.updates[0].id, 'old-wrap');
  assert.equal(plan.updates[0].set.price, 70);
  assert.equal(plan.updates[0].set.name, 'Veg Crispy Wrap');
  assert.equal(plan.updates.find(item => item.id === 'old-fries').set.name, 'Peri Peri Fries');
  assert.equal(plan.updates.find(item => item.id === 'old-fries').set.price, 95);
  assert.equal(plan.updates.find(item => item.id === 'old-fries').set.price, 95);
  assert.equal(plan.creates.filter(item => !item.imageUrl).length, 8);
  assert.equal(plan.creates.find(item => item.name === 'Cheddar Cheese Wrap').isVeg, null);
});

test('only explicit product names determine dietary classification', () => {
  assert.equal(classifyFromExplicitName('Chicken Seekh Wrap'), false);
  assert.equal(classifyFromExplicitName('Cottage Cheese Wrap'), true);
  assert.equal(classifyFromExplicitName('Cheddar Cheese Wrap'), null);
  assert.equal(classifyFromExplicitName('Veg Inferno'), true);
});

test('normalization and duplicate safeguards catch collisions', () => {
  assert.equal(normalizeMenuName('  Peri   PERI & Fries '), 'peri peri and fries');
  const duplicated = [...existingProducts, { ...existingProducts[0], _id: 'duplicate-wrap' }];
  assert.throws(() => planMenuImport({ manifest, imageSources, existingProducts: duplicated, existingCategories }), /More than one existing product matches Veg Crispy Wrap/);
});
