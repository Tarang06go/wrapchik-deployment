const test = require('node:test');
const assert = require('node:assert/strict');
const Coupon = require('../src/models/Coupon');
const Order = require('../src/models/Order');
const Notification = require('../src/models/Notification');
const User = require('../src/models/User');
const { previewCoupon, reserveCoupon, releaseCouponForOrder, markCouponRedeemed } = require('../src/utils/couponPricing');
const { slotStartsForSettings } = require('../src/controllers/pickupSlotController');
const { isCouponScheduleActive } = require('../src/utils/couponSchedule');
const { validateCouponInput } = require('../src/controllers/couponController');

const originalCouponMethods = {
  findOne: Coupon.findOne,
  findOneAndUpdate: Coupon.findOneAndUpdate,
  updateOne: Coupon.updateOne,
};
const originalUserFindById = User.findById;
const userId = '64b000000000000000000001';
const orderId = '64b000000000000000000002';
let coupon;
let capturedFilter;

test.beforeEach(() => {
  coupon = {
    _id: '64b000000000000000000003',
    code: 'SAVE10',
    description: 'Test offer',
    discountType: 'PERCENT',
    discountValue: 10,
    maxDiscountAmount: 25,
    minOrderValue: 100,
    usageLimit: 10,
    perCustomerLimit: 1,
    redemptionCount: 0,
    redemptions: [],
  };
  capturedFilter = null;
  Coupon.findOne = () => ({ select: async () => coupon });
  Coupon.findOneAndUpdate = async filter => { capturedFilter = filter; return { _id: coupon._id, code: coupon.code }; };
  Coupon.updateOne = async filter => { capturedFilter = filter; return { modifiedCount: 1 }; };
});

test.afterEach(() => {
  Coupon.findOne = originalCouponMethods.findOne;
  Coupon.findOneAndUpdate = originalCouponMethods.findOneAndUpdate;
  Coupon.updateOne = originalCouponMethods.updateOne;
  User.findById = originalUserFindById;
});

test('percentage coupon preview respects the maximum discount and minimum subtotal', async () => {
  const quote = await previewCoupon('save10', userId, 500);
  assert.equal(quote.discountAmount, 25);
  await assert.rejects(previewCoupon('SAVE10', userId, 99), /minimum item subtotal/);
});

test('coupon reservation uses atomic usage and per-customer predicates', async () => {
  const reservation = await reserveCoupon('SAVE10', userId, orderId, 500);
  assert.equal(reservation.discountAmount, 25);
  assert.ok(capturedFilter.$expr);
  assert.equal(capturedFilter.$expr.$and.length, 2);
});

test('coupon redemption limits reject a previously used customer', async () => {
  coupon.redemptions = [{ userId, orderId: '64b000000000000000000004', status: 'REDEEMED' }];
  await assert.rejects(previewCoupon('SAVE10', userId, 500), /maximum number of times/);
});

test('coupon schedule enforces India-local weekdays and inclusive-start/exclusive-end windows', () => {
  const coupon = { activeDays: [1], activeHours: { start: '09:00', end: '11:00' } };
  assert.equal(isCouponScheduleActive(coupon, new Date('2026-11-02T03:30:00.000Z')), true); // Monday 09:00 IST
  assert.equal(isCouponScheduleActive(coupon, new Date('2026-11-02T05:30:00.000Z')), false); // Monday 11:00 IST
  assert.equal(isCouponScheduleActive(coupon, new Date('2026-11-03T03:30:00.000Z')), false); // Tuesday
});

test('coupon schedule supports an overnight offer window and assigns its after-midnight time to the start day', () => {
  const coupon = { activeDays: [5], activeHours: { start: '22:00', end: '02:00' } };
  assert.equal(isCouponScheduleActive(coupon, new Date('2026-11-06T17:00:00.000Z')), true); // Friday 22:00 IST
  assert.equal(isCouponScheduleActive(coupon, new Date('2026-11-06T20:00:00.000Z')), true); // Saturday 01:00 IST
  assert.equal(isCouponScheduleActive(coupon, new Date('2026-11-06T21:00:00.000Z')), false); // Saturday 02:00 IST
});

test('coupon input accepts optional student/day/hour restrictions and rejects malformed schedules', () => {
  const base = { code: 'CAMPUS', discountType: 'PERCENT', discountValue: 10, usageLimit: 10, startsAt: '2026-11-01T00:00:00.000Z', expiresAt: '2026-12-01T00:00:00.000Z' };
  const parsed = validateCouponInput({ ...base, studentOnly: true, activeDays: [1, 3], activeHours: { start: '12:00', end: '14:00' } });
  assert.equal(parsed.studentOnly, true);
  assert.deepEqual(parsed.activeDays, [1, 3]);
  assert.deepEqual(parsed.activeHours, { start: '12:00', end: '14:00' });
  assert.throws(() => validateCouponInput({ ...base, activeDays: [7] }), /weekday numbers/);
  assert.throws(() => validateCouponInput({ ...base, activeHours: { start: '14:00', end: '14:00' } }), /valid start and end time/);
});

test('student-only coupon requires an active verified Thapar student identity', async () => {
  coupon.studentOnly = true;
  User.findById = () => ({ select: async () => ({ role: 'student', email: 'buyer@thapar.edu', emailVerified: true }) });
  assert.equal((await previewCoupon('SAVE10', userId, 500)).discountAmount, 25);
  User.findById = () => ({ select: async () => ({ role: 'student', email: 'buyer@thapar.edu', emailVerified: false }) });
  await assert.rejects(previewCoupon('SAVE10', userId, 500), /verified @thapar.edu/);
  User.findById = () => ({ select: async () => ({ role: 'admin', email: 'buyer@thapar.edu', emailVerified: true }) });
  await assert.rejects(previewCoupon('SAVE10', userId, 500), /verified @thapar.edu/);
});

test('coupon release and redemption mutations are scoped to a reserved order', async () => {
  await releaseCouponForOrder({ couponId: coupon._id, _id: orderId });
  assert.equal(capturedFilter.redemptions.$elemMatch.orderId, orderId);
  await markCouponRedeemed({ couponId: coupon._id, _id: orderId });
  assert.equal(capturedFilter.redemptions.$elemMatch.status, 'RESERVED');
});

test('scheduled pickup slots use India-local opening hours, lead time, and enabled state', () => {
  const settings = { scheduledPickupEnabled: true, takeawayEnabled: true, acceptingOrders: true, openTime: '09:00', closeTime: '10:00', pickupSlotMinutes: 30, estimatedPrepMinutes: 15 };
  const sameDaySlots = slotStartsForSettings(settings, new Date('2026-11-01T03:00:00.000Z')).filter(date => date.toISOString().startsWith('2026-11-01'));
  assert.deepEqual(sameDaySlots.map(date => date.toISOString()), ['2026-11-01T03:30:00.000Z', '2026-11-01T04:00:00.000Z']);
  assert.equal(slotStartsForSettings({ ...settings, scheduledPickupEnabled: false }, new Date('2026-11-01T03:00:00.000Z')).length, 0);
  assert.equal(slotStartsForSettings({ ...settings, acceptingOrders: false }, new Date('2026-11-01T03:00:00.000Z')).length, 0);
});

test('ordinary counter orders without an idempotency key are omitted from the unique string-key index', () => {
  const order = new Order({ userId, orderNumber: 'WRP-123456', items: [], subtotal: 0, totalAmount: 0 });
  assert.equal(order.idempotencyKey, undefined);
  const idempotencyIndex = Order.schema.indexes().find(([keys]) => keys.idempotencyKey === 1);
  assert.equal(idempotencyIndex?.[1]?.unique, true);
  assert.equal(idempotencyIndex?.[1]?.unique, true);
  assert.deepEqual(idempotencyIndex?.[1]?.partialFilterExpression, { idempotencyKey: { $type: 'string' } });
});

test('notification deduplication remains a unique sparse index', () => {
  const dedupeIndex = Notification.schema.indexes().find(([keys]) => keys.dedupeKey === 1);
  assert.equal(dedupeIndex?.[1]?.unique, true);
  assert.equal(dedupeIndex?.[1]?.sparse, true);
});
