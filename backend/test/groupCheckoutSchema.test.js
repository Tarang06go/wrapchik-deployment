const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const GroupOrder = require('../src/models/GroupOrder');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');

test('group checkout records member shares and pending outlet contributions without requiring a migration', () => {
  const leader = new mongoose.Types.ObjectId();
  const friend = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const group = new GroupOrder({
    groupCode: 'A1B2C3',
    leaderId: leader,
    members: [
      { userId: leader, name: 'Leader', status: 'JOINED' },
      { userId: friend, name: 'Friend', status: 'JOINED' },
    ],
    items: [{
      productId, selectedBy: leader, name: 'Wrap', priceAtPurchase: 100, quantity: 1,
      customizations: [], itemTotalPaise: 10000, shareMode: 'SHARED', revision: 1,
      allocations: [
        { userId: leader, percentageBps: 5000, amountPaise: 5000, acceptedRevision: 1, acceptedAt: new Date() },
        { userId: friend, percentageBps: 5000, amountPaise: 5000, acceptedRevision: 1, acceptedAt: new Date() },
      ],
    }],
    status: 'ORDERED',
    checkoutMode: 'SPLIT',
    paymentMethod: 'UPI_QR',
    memberShares: [{ userId: leader, amountPaise: 5000 }, { userId: friend, amountPaise: 5000 }],
    contributions: [
      { userId: leader, amountPaise: 5000, method: 'UPI_QR', status: 'PENDING' },
      { userId: friend, amountPaise: 5000, method: 'UPI_QR', status: 'PENDING' },
    ],
  });
  assert.equal(group.validateSync(), undefined);
  assert.equal(group.contributions.reduce((sum, contribution) => sum + contribution.amountPaise, 0), 10000);
  assert.equal(group.contributions.every((contribution) => contribution.status === 'PENDING'), true);
});

test('a single immutable order preserves group item ownership and shared-dish paise allocations', () => {
  const leader = new mongoose.Types.ObjectId();
  const friend = new mongoose.Types.ObjectId();
  const groupId = new mongoose.Types.ObjectId();
  const order = new Order({
    userId: leader,
    orderNumber: 'WRP-123456',
    items: [{
      name: 'Shared Wrap', priceAtPurchase: 100, quantity: 1, itemTotal: 100,
      selectedBy: leader, shareMode: 'SHARED',
      groupAllocations: [{ userId: leader, amountPaise: 5000 }, { userId: friend, amountPaise: 5000 }],
    }],
    subtotal: 100, taxAndFees: 5, totalAmount: 105,
    paymentMethod: 'UPI_QR', paymentStatus: 'PENDING', orderStatus: 'PLACED',
    groupOrderId: groupId, groupCheckoutMode: 'SPLIT',
  });
  assert.equal(order.validateSync(), undefined);
  assert.equal(order.items[0].groupAllocations.reduce((sum, allocation) => sum + allocation.amountPaise, 0), 10000);
});

test('group UPI payment records bind the user contribution and immutable order amount', () => {
  const orderId = new mongoose.Types.ObjectId();
  const groupId = new mongoose.Types.ObjectId();
  const contributionId = new mongoose.Types.ObjectId();
  const studentId = new mongoose.Types.ObjectId();
  const payment = new Payment({
    orderId, groupOrderId: groupId, groupContributionId: contributionId, userId: studentId,
    gatewayOrderId: 'GROUP_UPI_test', gateway: 'UPI_QR', method: 'UPI_QR', amount: 25,
    status: 'PENDING', upiTransactionReference: 'TXN12345678',
  });
  assert.equal(payment.validateSync(), undefined);
  assert.equal(String(payment.groupContributionId), String(contributionId));
  assert.equal(payment.status, 'PENDING');
});

test('new UPI reference hashes have a sparse unique index and leave legacy payments outside it', () => {
  const indexes = Payment.schema.indexes();
  assert.ok(indexes.some(([spec, options]) => spec.upiReferenceHash === 1
    && options.unique === true
    && options.sparse === true
    && options.name === 'upiReferenceHash_uniqueSparse'));
  const legacyPayment = new Payment({
    orderId: new mongoose.Types.ObjectId(), userId: new mongoose.Types.ObjectId(),
    gatewayOrderId: 'LEGACY-UPI', amount: 10, method: 'UPI_QR',
  });
  assert.equal(legacyPayment.upiReferenceHash, undefined);
});
