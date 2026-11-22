const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { getAdminOrderAction } = require('../utils/adminOrderAction.cjs');

const readProjectFile = relative => fs.readFileSync(path.resolve(__dirname, '..', relative), 'utf8');

test('paid counter orders follow the state machine one action at a time', () => {
  assert.deepEqual(getAdminOrderAction({ orderStatus: 'PLACED', paymentMethod: 'COUNTER', paymentStatus: 'SUCCESS' }), { status: 'ACCEPTED', title: 'Accept' });
  assert.deepEqual(getAdminOrderAction({ orderStatus: 'ACCEPTED', paymentStatus: 'SUCCESS' }), { status: 'PREPARING', title: 'Start Preparing' });
  assert.deepEqual(getAdminOrderAction({ orderStatus: 'PREPARING', paymentStatus: 'SUCCESS', orderType: 'TAKEAWAY' }), { status: 'READY', title: 'Mark Ready for Pickup' });
  assert.deepEqual(getAdminOrderAction({ orderStatus: 'READY', paymentStatus: 'SUCCESS', orderType: 'TAKEAWAY' }), { status: 'COMPLETED', title: 'Mark Completed' });
});

test('cash may be accepted before receipt, but unpaid orders cannot be completed or handed off', () => {
  assert.deepEqual(getAdminOrderAction({ orderStatus: 'PLACED', paymentMethod: 'COUNTER', paymentStatus: 'PENDING' }), { status: 'ACCEPTED', title: 'Accept' });
  assert.equal(getAdminOrderAction({ orderStatus: 'READY', paymentMethod: 'COUNTER', paymentStatus: 'PENDING' }), null);
  assert.equal(getAdminOrderAction({ orderStatus: 'PICKED_UP', orderType: 'DELIVERY', paymentStatus: 'PENDING' }), null);
  assert.equal(getAdminOrderAction({ orderStatus: 'SERVED', orderType: 'DINE_IN', paymentStatus: 'PENDING' }), null);
});

test('unpaid online/group orders cannot be accepted and terminal states expose no action', () => {
  assert.equal(getAdminOrderAction({ orderStatus: 'PLACED', paymentMethod: 'UPI_QR', paymentStatus: 'PENDING' }), null);
  assert.equal(getAdminOrderAction({ orderStatus: 'PLACED', paymentMethod: 'COUNTER', paymentStatus: 'PENDING', groupOrderId: 'group' }), null);
  assert.equal(getAdminOrderAction({ orderStatus: 'COMPLETED', paymentStatus: 'SUCCESS' }), null);
});

test('paid READY takeaways expose student QR and admin has both scan and manual verification paths', () => {
  const tracking = readProjectFile('app/order-tracking/[id].jsx');
  const pickup = readProjectFile('app/admin/pickup.jsx');
  const dashboard = readProjectFile('app/admin/dashboard.jsx');
  assert.match(tracking, /order\.orderType === 'TAKEAWAY' && order\.orderStatus === 'READY' && order\.paymentStatus === 'SUCCESS'/);
  assert.match(pickup, /CameraView/);
  assert.match(pickup, /adminService\.verifyPickupQr/);
  assert.match(pickup, /value=\{orderId\}/);
  assert.match(pickup, /value=\{token\}/);
  assert.match(dashboard, /router\.push\('\/admin\/pickup'\)/);
});
