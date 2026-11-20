const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Order = require('../src/models/Order');
const User = require('../src/models/User');
const LoyaltyLedger = require('../src/models/LoyaltyLedger');
const { reserveLoyaltyRedemption, rollbackLoyaltyReservation, releaseLoyaltyRedemption, awardLoyaltyForCompletedOrder } = require('../src/utils/loyaltyLedger');

const originals = { orderFindOneAndUpdate: Order.findOneAndUpdate, orderUpdateOne: Order.updateOne, userFindOneAndUpdate: User.findOneAndUpdate, userUpdateOne: User.updateOne, ledgerCreate: LoyaltyLedger.create, ledgerExists: LoyaltyLedger.exists };
const userId = new mongoose.Types.ObjectId();
const orderId = new mongoose.Types.ObjectId();
const activePolicy = { enabled: true, earnEveryRupees: 100, pointsPerStep: 2, paisePerPoint: 50, minimumRedemptionPoints: 10, maxRedemptionPercent: 20 };
let ledgerEntries;
let balanceWrites;

test.beforeEach(() => {
  ledgerEntries = [];
  balanceWrites = [];
  User.findOneAndUpdate = async (filter, update) => { balanceWrites.push({ filter, update }); return { _id: userId }; };
  User.updateOne = async (filter, update) => { balanceWrites.push({ filter, update }); return { modifiedCount: 1 }; };
  LoyaltyLedger.create = async row => { ledgerEntries.push(row); return row; };
});
test.afterEach(() => {
  Order.findOneAndUpdate = originals.orderFindOneAndUpdate;
  Order.updateOne = originals.orderUpdateOne;
  User.findOneAndUpdate = originals.userFindOneAndUpdate;
  User.updateOne = originals.userUpdateOne;
  LoyaltyLedger.create = originals.ledgerCreate;
  LoyaltyLedger.exists = originals.ledgerExists;
});

test('redemption atomically decrements a student balance and appends a negative ledger entry', async () => {
  const reservation = await reserveLoyaltyRedemption({ userId, orderId, points: 20, discountPaise: 1000 });
  assert.deepEqual(reservation, { points: 20, discountAmount: 10 });
  assert.deepEqual(balanceWrites[0].filter.loyaltyPointsBalance, { $gte: 20 });
  assert.equal(balanceWrites[0].update.$inc.loyaltyPointsBalance, -20);
  assert.equal(ledgerEntries[0].type, 'REDEEM');
  assert.equal(ledgerEntries[0].pointsDelta, -20);
});

test('failed order creation has an append-only points release entry', async () => {
  LoyaltyLedger.exists = async () => false;
  assert.equal(await rollbackLoyaltyReservation({ userId, orderId, points: 10, discountPaise: 500 }), true);
  assert.equal(balanceWrites[0].update.$inc.loyaltyPointsBalance, 10);
  assert.equal(ledgerEntries[0].type, 'REDEEM_RELEASE');
});

test('a redemption is returned once after an unpaid cancelled order', async () => {
  Order.findOneAndUpdate = async filter => {
    assert.deepEqual(filter.paymentStatus, { $ne: 'SUCCESS' });
    assert.equal(filter.orderStatus.$in.includes('CANCELLED'), true);
    return { _id: orderId, userId, loyaltyPointsRedeemed: 12, loyaltyDiscountAmount: 6 };
  };
  assert.equal(await releaseLoyaltyRedemption({ _id: orderId, userId, loyaltyPointsRedeemed: 12 }), true);
  assert.equal(balanceWrites[0].update.$inc.loyaltyPointsBalance, 12);
  assert.equal(ledgerEntries[0].type, 'REDEEM_RELEASE');
});

test('only a paid, completed individual order earns points once', async () => {
  Order.findOneAndUpdate = async (filter, update) => {
    assert.equal(filter.paymentStatus, 'SUCCESS');
    assert.equal(update.$set.loyaltyPointsEarned, 2);
    return { _id: orderId, userId };
  };
  const incomplete = await awardLoyaltyForCompletedOrder({ _id: orderId, paymentStatus: 'SUCCESS', orderStatus: 'READY', subtotal: 200 }, activePolicy);
  assert.equal(incomplete, 0);
  const group = await awardLoyaltyForCompletedOrder({ _id: orderId, groupOrderId: userId, paymentStatus: 'SUCCESS', orderStatus: 'COMPLETED', subtotal: 200 }, activePolicy);
  assert.equal(group, 0);
  const points = await awardLoyaltyForCompletedOrder({ _id: orderId, userId, paymentStatus: 'SUCCESS', orderStatus: 'COMPLETED', subtotal: 200, discountAmount: 20, loyaltyDiscountAmount: 5, loyaltyEarnEveryRupeesSnapshot: 100, loyaltyPointsPerStepSnapshot: 2 }, activePolicy);
  assert.equal(points, 2);
  assert.equal(balanceWrites[0].update.$inc.loyaltyLifetimePoints, 2);
  assert.equal(ledgerEntries[0].type, 'EARN');
});
