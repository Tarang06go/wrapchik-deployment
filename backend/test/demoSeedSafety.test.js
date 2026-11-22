const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertDemoSeedTarget, assertDemoApplyConfirmation } = require('../src/utils/demoSeedSafety');
const { buildDemoCataloguePlan } = require('../src/utils/demoCataloguePlan');
const { parseCorsOrigins } = require('../src/utils/corsOrigins');
const { assertProductionDatabaseUri } = require('../src/utils/runtimeConfig');
const { validateImageSources } = require('../src/scripts/seedDemoDatabase');

test('demo seeding only accepts the isolated local demo database', () => {
  assert.deepEqual(assertDemoSeedTarget('mongodb://127.0.0.1:27017/wrapchik_demo', 'development'), { host: '127.0.0.1', databaseName: 'wrapchik_demo' });
  for (const uri of [
    'mongodb://127.0.0.1:27017/wrapchik',
    'mongodb://db.example.test:27017/wrapchik_demo',
    'mongodb+srv://db.example.test/wrapchik_demo',
  ]) assert.throws(() => assertDemoSeedTarget(uri, 'development'), /restricted to localhost/i);
  assert.throws(() => assertDemoSeedTarget('mongodb://127.0.0.1:27017/wrapchik_demo', 'production'), /disabled in production/i);
});

test('applying demo data requires an explicit isolated-database confirmation', () => {
  assert.doesNotThrow(() => assertDemoApplyConfirmation(false, false));
  assert.throws(() => assertDemoApplyConfirmation(true, false), /--confirm-demo-db/);
  assert.doesNotThrow(() => assertDemoApplyConfirmation(true, true));
});

test('production CORS accepts only exact HTTPS origins and development LAN origins remain supported', () => {
  assert.deepEqual(parseCorsOrigins('https://wrapchik.example,https://admin.wrapchik.example', 'production'), ['https://wrapchik.example', 'https://admin.wrapchik.example']);
  for (const value of ['', '*', 'http://wrapchik.example', 'https://wrapchik.example/path', 'https://user:pass@wrapchik.example']) {
    assert.throws(() => parseCorsOrigins(value, 'production'), /CORS_ORIGIN|HTTPS origins/i);
  }
  assert.deepEqual(parseCorsOrigins('http://localhost:8081,http://192.168.1.5:8081', 'development'), ['http://localhost:8081', 'http://192.168.1.5:8081']);
});

test('production requires an explicit non-local MongoDB database URL', () => {
  assert.doesNotThrow(() => assertProductionDatabaseUri('mongodb+srv://cluster.example.test/wrapchik', 'production'));
  assert.doesNotThrow(() => assertProductionDatabaseUri(undefined, 'development'));
  for (const uri of [undefined, '', 'mongodb://127.0.0.1:27017/wrapchik', 'not-a-mongo-uri']) {
    assert.throws(() => assertProductionDatabaseUri(uri, 'production'), /MONGO_URI|MongoDB database/i);
  }
});

test('demo catalogue plan seeds only confirmed screenshot menu rows and holds ambiguous names', () => {
  const data = path.resolve(__dirname, '../data');
  const manifest = JSON.parse(fs.readFileSync(path.join(data, 'menu-import-2026-11-20.json'), 'utf8'));
  const imageSources = JSON.parse(fs.readFileSync(path.join(data, 'menu-image-sources.json'), 'utf8'));
  const plan = buildDemoCataloguePlan({ manifest, imageSources });
  assert.equal(plan.creates.length, 61);
  assert.equal(plan.missingCategories.length, 6);
  const ambiguousNames = manifest.products.filter(row => row.status === 'needs_review').map(row => row.name);
  assert.deepEqual(plan.reviewItems.filter(row => ambiguousNames.includes(row.name)).map(row => row.name), ambiguousNames);
  assert.equal(new Set(plan.creates.map(row => `${row.categoryName.toLowerCase()}|${row.name.toLowerCase()}`)).size, plan.creates.length);
  assert.doesNotThrow(validateImageSources);
});
