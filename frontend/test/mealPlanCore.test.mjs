import test from 'node:test';
import assert from 'node:assert/strict';
import { createMealPlanSnapshot, getMealReminderDate } from '../utils/mealPlanCore.js';

test('meal plan snapshot saves product identity and current customization names without prices', () => {
  const plan = createMealPlanSnapshot('  Study lunch  ', [{ productId: 'p-1', name: 'Paneer Wrap', quantity: 2, unitPrice: 120, customizations: [{ name: 'Extra cheese', price: 20 }] }]);
  assert.equal(plan.name, 'Study lunch');
  assert.deepEqual(plan.items, [{ productId: 'p-1', productName: 'Paneer Wrap', quantity: 2, customizationNames: ['Extra cheese'] }]);
  assert.equal('unitPrice' in plan.items[0], false);
  assert.equal(plan.notificationId, null);
});

test('meal plan validation rejects blank names and empty carts', () => {
  assert.throws(() => createMealPlanSnapshot(' ', [{ productId: 'p' }]), /name/);
  assert.throws(() => createMealPlanSnapshot('Lunch', []), /cart/);
});

test('reminder times are scheduled for tomorrow or seven days later at 9am local time', () => {
  const now = new Date(2026, 10, 20, 18, 30, 0);
  const tomorrow = getMealReminderDate('TOMORROW', now);
  const nextWeek = getMealReminderDate('NEXT_WEEK', now);
  assert.equal(tomorrow.getDate(), 21);
  assert.equal(tomorrow.getHours(), 9);
  assert.equal(nextWeek.getDate(), 27);
  assert.equal(nextWeek.getHours(), 9);
  assert.throws(() => getMealReminderDate('UNKNOWN', now), /supported/);
});
