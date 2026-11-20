const test = require('node:test');
const assert = require('node:assert/strict');
const RestaurantSettings = require('../src/models/RestaurantSettings');
const { updateSettings } = require('../src/controllers/settingsController');
const { minimumGroupSubtotalPaise, meetsGroupMinimum } = require('../src/utils/groupMinimumOrder');

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const settingsFixture = () => ({
  acceptingOrders: true, openTime: '09:00', closeTime: '23:00', upiEnabled: false, upiId: '', upiPayeeName: '', cashEnabled: true,
  promoBanner: { enabled: false, title: '', message: '', ctaLabel: '', ctaRoute: '/(tabs)/menu' },
  promoBanners: [],
  saves: 0,
  async save() { this.saves += 1; },
});

test('promotion schema is additive, disabled by default and limited to app-owned routes', () => {
  const defaults = new RestaurantSettings().promoBanner;
  assert.equal(defaults.enabled, false);
  assert.equal(defaults.ctaRoute, '/(tabs)/menu');
  assert.deepEqual(RestaurantSettings.schema.path('promoBanner').schema.path('ctaRoute').enumValues, ['/(tabs)/home', '/(tabs)/menu', '/group-order']);
});

test('group minimum defaults off and compares integer paise against the configured rupee amount', () => {
  const settings = new RestaurantSettings();
  assert.equal(settings.groupMinimumOrderValue, 0);
  assert.equal(minimumGroupSubtotalPaise(settings), 0);
  assert.equal(meetsGroupMinimum(settings, 1), true);
  assert.equal(minimumGroupSubtotalPaise({ groupMinimumOrderValue: 75.5 }), 7550);
  assert.equal(meetsGroupMinimum({ groupMinimumOrderValue: 75.5 }, 7549), false);
  assert.equal(meetsGroupMinimum({ groupMinimumOrderValue: 75.5 }, 7550), true);
});

test('active-order overdue threshold defaults to 30 minutes and accepts only 1–240 minutes', async () => {
  assert.equal(new RestaurantSettings().orderOverdueMinutes, 30);
  const original = RestaurantSettings.getSettings;
  const settings = settingsFixture();
  settings.orderOverdueMinutes = 30;
  RestaurantSettings.getSettings = async () => settings;
  try {
    const accepted = response();
    await updateSettings({ body: { orderOverdueMinutes: 45 } }, accepted, error => { throw error; });
    assert.equal(accepted.statusCode, 200);
    assert.equal(settings.orderOverdueMinutes, 45);
    const rejected = response();
    await updateSettings({ body: { orderOverdueMinutes: 0 } }, rejected, error => { throw error; });
    assert.equal(rejected.statusCode, 400);
    assert.equal(settings.orderOverdueMinutes, 45);
  } finally { RestaurantSettings.getSettings = original; }
});

test('admin can publish a valid home banner through settings', async () => {
  const original = RestaurantSettings.getSettings;
  const settings = settingsFixture();
  RestaurantSettings.getSettings = async () => settings;
  try {
    const res = response();
    await updateSettings({ body: { promoBanner: { enabled: true, title: 'Campus combo', message: 'See the new menu offer.', ctaLabel: 'View menu', ctaRoute: '/(tabs)/menu' } } }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.equal(settings.saves, 1);
    assert.equal(res.body.settings.promoBanner.title, 'Campus combo');
  } finally { RestaurantSettings.getSettings = original; }
});

test('banner destinations cannot be external or enabled without complete copy', async () => {
  const original = RestaurantSettings.getSettings;
  const settings = settingsFixture();
  RestaurantSettings.getSettings = async () => settings;
  try {
    const external = response();
    await updateSettings({ body: { promoBanner: { enabled: true, title: 'x', message: 'y', ctaLabel: 'Go', ctaRoute: 'https://example.test' } } }, external, (error) => { throw error; });
    assert.equal(external.statusCode, 400);
    const incomplete = response();
    await updateSettings({ body: { promoBanner: { enabled: true, title: '', message: '', ctaLabel: '' } } }, incomplete, (error) => { throw error; });
    assert.equal(incomplete.statusCode, 400);
    assert.equal(settings.saves, 0);
  } finally { RestaurantSettings.getSettings = original; }
});

test('admin group minimum accepts safe non-negative values and rejects invalid values', async () => {
  const original = RestaurantSettings.getSettings;
  const settings = settingsFixture();
  settings.groupMinimumOrderValue = 0;
  RestaurantSettings.getSettings = async () => settings;
  try {
    const accepted = response();
    await updateSettings({ body: { groupMinimumOrderValue: 75.5 } }, accepted, error => { throw error; });
    assert.equal(accepted.statusCode, 200);
    assert.equal(settings.groupMinimumOrderValue, 75.5);
    const rejected = response();
    await updateSettings({ body: { groupMinimumOrderValue: -1 } }, rejected, error => { throw error; });
    assert.equal(rejected.statusCode, 400);
  } finally { RestaurantSettings.getSettings = original; }
});

test('home campaign carousel accepts Cloudinary images and an optional active window', async () => {
  const original = RestaurantSettings.getSettings;
  const settings = settingsFixture();
  RestaurantSettings.getSettings = async () => settings;
  try {
    const res = response();
    await updateSettings({ body: { promoBanners: [{ enabled: true, title: 'Campus lunch', message: 'Fresh wraps at SAC.', imageUrl: 'https://res.cloudinary.com/wrapchik/image/upload/v1/lunch.jpg', ctaLabel: 'View menu', ctaRoute: '/(tabs)/menu', activeFrom: '2026-11-20T09:00:00+05:30', activeUntil: '2026-11-21T09:00:00+05:30', sortOrder: 0 }] } }, res, error => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.equal(settings.saves, 1);
    assert.equal(settings.promoBanners[0].title, 'Campus lunch');
  } finally { RestaurantSettings.getSettings = original; }
});

test('enabled carousel campaigns reject non-Cloudinary images and invalid active windows', async () => {
  const original = RestaurantSettings.getSettings;
  const settings = settingsFixture();
  RestaurantSettings.getSettings = async () => settings;
  const campaign = { enabled: true, title: 'Offer', message: 'Message', imageUrl: 'https://images.example.org/offer.jpg', ctaLabel: 'Menu', ctaRoute: '/(tabs)/menu' };
  try {
    const badImage = response();
    await updateSettings({ body: { promoBanners: [campaign] } }, badImage, error => { throw error; });
    assert.equal(badImage.statusCode, 400);
    const badDates = response();
    await updateSettings({ body: { promoBanners: [{ ...campaign, imageUrl: 'https://res.cloudinary.com/wrapchik/offer.jpg', activeFrom: '2026-11-21T10:00:00Z', activeUntil: '2026-11-20T10:00:00Z' }] } }, badDates, error => { throw error; });
    assert.equal(badDates.statusCode, 400);
    assert.equal(settings.saves, 0);
  } finally { RestaurantSettings.getSettings = original; }
});
