const test = require('node:test');
const assert = require('node:assert/strict');
const { estimatePrepMinutes, getIndiaHour, clearPrepEtaCache, MIN_SAMPLE_COUNT } = require('../src/utils/prepEta');

test.beforeEach(clearPrepEtaCache);

test('rolling prep ETA groups orders by outlet-local hour and bounds the prep interval', async () => {
  let pipeline;
  const estimate = await estimatePrepMinutes({
    order: { createdAt: new Date('2026-11-20T03:30:00.000Z'), orderType: 'TAKEAWAY' },
    fallbackMinutes: 15,
    now: new Date('2026-11-20T04:00:00.000Z'),
    aggregate: async query => { pipeline = query; return [{ samples: 8, averageMs: 28.2 * 60000 }]; },
  });
  assert.equal(getIndiaHour(new Date('2026-11-20T03:30:00.000Z')), 9);
  assert.equal(pipeline[2].$match.hour, 9);
  assert.equal(pipeline[2].$match.durationMs.$gte, 60000);
  assert.deepEqual(estimate, { minutes: 28, samples: 8, source: 'rolling_hourly_average' });
});

test('few historical samples and missing order time use the saved outlet estimate', async () => {
  let calls = 0;
  const sparse = await estimatePrepMinutes({ order: { createdAt: new Date(), orderType: 'DELIVERY' }, fallbackMinutes: 22, now: new Date(), aggregate: async () => { calls += 1; return [{ samples: MIN_SAMPLE_COUNT - 1, averageMs: 5 * 60000 }]; } });
  const missing = await estimatePrepMinutes({ order: {}, fallbackMinutes: 22, aggregate: async () => { calls += 1; return []; } });
  assert.deepEqual(sparse, { minutes: 22, source: 'outlet_default', samples: MIN_SAMPLE_COUNT - 1 });
  assert.deepEqual(missing, { minutes: 22, source: 'outlet_default', samples: 0 });
  assert.equal(calls, 1);
});

test('rolling estimates are briefly cached by fulfilment type and India-local hour', async () => {
  let calls = 0;
  const options = { order: { createdAt: new Date('2026-11-20T03:30:00.000Z'), orderType: 'DINE_IN' }, fallbackMinutes: 15, now: new Date('2026-11-20T04:00:00.000Z'), aggregate: async () => { calls += 1; return [{ samples: 5, averageMs: 12 * 60000 }]; } };
  await estimatePrepMinutes(options);
  const second = await estimatePrepMinutes(options);
  assert.equal(calls, 1);
  assert.equal(second.minutes, 12);
  assert.equal(second.source, 'rolling_hourly_average');
});
