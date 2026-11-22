const test = require('node:test');
const assert = require('node:assert/strict');
const { inspectMenu } = require('../src/utils/menuAudit');

test('read-only menu audit reports duplicate, missing image, suspect prices and reference drift', () => {
  const report = inspectMenu({
    categories: [{ _id: 'c1', name: 'Wraps' }],
    products: [
      { _id: 'p1', name: ' Paneer  Wrap ', price: 120, imageUrl: '', categoryId: 'c1', isVeg: true },
      { _id: 'p2', name: 'paneer wrap', price: 1200, imageUrl: 'https://example.test/p.png', categoryId: 'gone', isVeg: null },
    ],
    referenceItems: [{ name: 'Paneer Wrap', price: 110 }, { name: 'Lost Item', price: 20 }],
    knownCategories: ['Wraps'],
  });
  assert.equal(report.reference.missingFromDatabase[0], 'Lost Item');
  assert.equal(report.reference.priceDifferences[0].databasePrice, 120);
  assert.deepEqual(report.findings.map((item) => item.type).sort(), ['duplicate_name', 'incomplete_dietary_classification', 'missing_category', 'missing_image', 'suspect_price']);
});

test('read-only menu audit flags malformed and non-HTTPS image URLs without rewriting catalogue data', () => {
  const report = inspectMenu({ categories: [{ _id: 'c', name: 'Wraps' }], products: [
    { _id: 'one', name: 'Relative image', imageUrl: '/photo.jpg', categoryId: 'c', isVeg: false, price: 80 },
    { _id: 'two', name: 'Secure image', imageUrl: 'https://images.example/photo.jpg', categoryId: 'c', isVeg: null, price: 80 },
    { _id: 'three', name: 'HTTP image', imageUrl: 'http://images.example/photo.jpg', categoryId: 'c', isVeg: true, price: 80 },
  ] });
  assert.deepEqual(report.findings.map(item => item.type).sort(), ['incomplete_dietary_classification', 'insecure_image_url', 'invalid_image_url']);
});
