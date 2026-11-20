const test = require('node:test');
const assert = require('node:assert/strict');
const { inspectMenu } = require('../src/utils/menuAudit');

test('read-only menu audit reports duplicate, missing image, suspect prices and reference drift', () => {
  const report = inspectMenu({
    categories: [{ _id: 'c1', name: 'Wraps' }],
    products: [
      { _id: 'p1', name: ' Paneer  Wrap ', price: 120, imageUrl: '', categoryId: 'c1' },
      { _id: 'p2', name: 'paneer wrap', price: 1200, imageUrl: 'https://example.test/p.png', categoryId: 'gone' },
    ],
    referenceItems: [{ name: 'Paneer Wrap', price: 110 }, { name: 'Lost Item', price: 20 }],
    knownCategories: ['Wraps'],
  });
  assert.equal(report.reference.missingFromDatabase[0], 'Lost Item');
  assert.equal(report.reference.priceDifferences[0].databasePrice, 120);
  assert.deepEqual(report.findings.map((item) => item.type).sort(), ['duplicate_name', 'missing_category', 'missing_image', 'suspect_price']);
});
