const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCoPurchasePipeline } = require('../src/utils/recommendationPipeline');
const { CACHE_TTL_MS, getOrCreateRecommendation, clearRecommendationCache } = require('../src/utils/recommendationCache');
const { selectPreviouslyOrderedProducts } = require('../src/utils/previouslyOrderedProducts');

test('recommendations use verified completed order co-purchases and suppress unavailable stock', () => {
  const seed = ['seed-product'];
  const pipeline = buildCoPurchasePipeline(seed, 'products');
  assert.deepEqual(pipeline[0].$match, {
    paymentStatus: 'SUCCESS',
    orderStatus: { $in: ['COMPLETED', 'DELIVERED', 'SERVED'] },
    'items.productId': { $in: seed },
  });
  assert.deepEqual(pipeline[2].$match['items.productId'].$nin, seed);
  assert.equal(pipeline[4].$lookup.from, 'products');
  assert.deepEqual(pipeline[6].$match.$or, [{ 'product.stock': null }, { 'product.stock': { $gt: 0 } }]);
  assert.equal(pipeline.at(-2).$limit, 4);
});

test('recommendation aggregation cache expires quickly and reuses recent values', async () => {
  clearRecommendationCache();
  let calls = 0;
  const loader = async () => [{ revision: ++calls }];
  const first = await getOrCreateRecommendation('seed', loader, 10_000);
  const cached = await getOrCreateRecommendation('seed', loader, 10_000 + CACHE_TTL_MS - 1);
  const fresh = await getOrCreateRecommendation('seed', loader, 10_000 + CACHE_TTL_MS);
  assert.equal(first[0].revision, 1);
  assert.equal(cached[0].revision, 1);
  assert.equal(fresh[0].revision, 2);
  clearRecommendationCache();
});

test('previously ordered rail returns current catalog records in purchase recency order without duplicates', () => {
  const current = [
    { _id: 'burger', name: 'Burger', price: 95 },
    { _id: 'wrap', name: 'Wrap', price: 100 },
  ];
  assert.deepEqual(
    selectPreviouslyOrderedProducts(['wrap', 'wrap', 'removed', 'burger'], current),
    [current[1], current[0]],
  );
});
