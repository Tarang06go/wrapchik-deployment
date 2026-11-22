const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { validateNumericText, validateLoyaltyDraft } = require('../utils/adminNumericForm.cjs');

const appSource = relative => fs.readFileSync(path.join(__dirname, '..', 'app', relative), 'utf8');

test('numeric input stays text while typing and rejects symbols, empty required values and non-finite values at save', () => {
  assert.equal('%', String('%'));
  assert.match(validateNumericText('%', { label: 'Reward percent' }).error, /valid number/);
  assert.match(validateNumericText('', { label: 'Reward percent' }).error, /required/);
  assert.match(validateNumericText('9'.repeat(400), { label: 'Reward percent' }).error, /finite/);
});

test('numeric validation accepts decimals and boundary values but rejects negatives, excess precision and out-of-range values', () => {
  assert.deepEqual(validateNumericText('12.50', { label: 'Delivery fee', max: 1000 }), { value: 12.5, error: null });
  assert.equal(validateNumericText('0', { label: 'Capacity', min: 0, max: 100, integer: true }).value, 0);
  assert.equal(validateNumericText('100', { label: 'Capacity', min: 1, max: 100, integer: true }).value, 100);
  assert.match(validateNumericText('-1', { label: 'Percent', min: 0, max: 50 }).error, /at least 0/);
  assert.match(validateNumericText('1.234', { label: 'Amount', maxDecimalPlaces: 2 }).error, /decimal places/);
  assert.match(validateNumericText('51', { label: 'Percent', min: 0, max: 50 }).error, /no more than 50/);
  assert.match(validateNumericText('2.5', { label: 'Whole number', integer: true }).error, /whole number/);
});

test('loyalty draft can be cleared while disabled but cannot enable without valid values and a zero-point first tier', () => {
  const disabled = validateLoyaltyDraft({ enabled: false, earnEveryRupees: '', pointsPerStep: '', paisePerPoint: '', minimumRedemptionPoints: '', maxRedemptionPercent: '', tiers: [] });
  assert.deepEqual(disabled.errors, {});
  assert.equal(disabled.policy.enabled, false);
  assert.equal(disabled.policy.earnEveryRupees, 0);

  const invalidEnable = validateLoyaltyDraft({ enabled: true, earnEveryRupees: '%', pointsPerStep: '', paisePerPoint: '1', minimumRedemptionPoints: '1', maxRedemptionPercent: '51', tiers: [{ name: 'Starter', minimumLifetimePoints: '10' }] });
  assert.ok(invalidEnable.errors.earnEveryRupees);
  assert.ok(invalidEnable.errors.pointsPerStep);
  assert.ok(invalidEnable.errors.maxRedemptionPercent);
  assert.ok(invalidEnable.errors['tier.0.minimumLifetimePoints']);
  assert.equal(invalidEnable.policy, null);

  const valid = validateLoyaltyDraft({ enabled: true, earnEveryRupees: '100', pointsPerStep: '5', paisePerPoint: '10', minimumRedemptionPoints: '5', maxRedemptionPercent: '20', tiers: [{ name: 'Campus', minimumLifetimePoints: '0' }] });
  assert.deepEqual(valid.errors, {});
  assert.equal(valid.policy.earnEveryRupees, 100);
});

test('loyalty tier names and thresholds must remain unique', () => {
  const result = validateLoyaltyDraft({ enabled: false, earnEveryRupees: '0', pointsPerStep: '0', paisePerPoint: '0', minimumRedemptionPoints: '0', maxRedemptionPercent: '0', tiers: [{ name: 'Campus', minimumLifetimePoints: '0' }, { name: 'campus', minimumLifetimePoints: '0' }] });
  assert.ok(result.errors['tier.0.name']);
  assert.ok(result.errors['tier.1.minimumLifetimePoints']);
});

test('admin settings, coupon and product fields keep raw text while typing and gate API saves', () => {
  const settings = appSource('admin/settings.jsx');
  const coupons = appSource('admin/coupons.jsx');
  const products = appSource('admin/products.jsx');
  assert.doesNotMatch(settings, /onChangeText=\{[^}]*\bNumber\s*\(/s);
  assert.doesNotMatch(coupons, /onChangeText=\{[^}]*\bNumber\s*\(/s);
  assert.doesNotMatch(products, /onChangeText=\{[^}]*\bNumber\s*\(/s);
  assert.match(settings, /validateLoyaltyDraft/);
  assert.match(coupons, /if \(Object\.keys\(errors\)\.length\) return;/);
  assert.match(products, /if \(Object\.keys\(errors\)\.length\) return;/);
});
