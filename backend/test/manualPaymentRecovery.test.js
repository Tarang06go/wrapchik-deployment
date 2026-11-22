const test = require('node:test');
const assert = require('node:assert/strict');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');
const RestaurantSettings = require('../src/models/RestaurantSettings');

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('UPI resume refuses another payment handoff while a transaction reference awaits review', async () => {
  const originals = { orderFindById: Order.findById, paymentFindOne: Payment.findOne, settings: RestaurantSettings.getSettings };
  let settingsRead = false;
  Order.findById = async id => ({ _id: id, userId: '64b000000000000000000002', orderStatus: 'PLACED', paymentStatus: 'PENDING', paymentMethod: 'UPI_QR', totalAmount: 84 });
  Payment.findOne = query => ({ select: async () => ({ _id: 'claim', status: 'PENDING', query }) });
  RestaurantSettings.getSettings = async () => { settingsRead = true; return { upiEnabled: true, upiId: 'wrapchik@bank', upiPayeeName: 'Wrapchik' }; };
  try {
    const { getUpiInstructions } = require('../src/controllers/manualPaymentController');
    const res = response();
    await getUpiInstructions({ params: { orderId: '64b000000000000000000001' }, user: { _id: '64b000000000000000000002' } }, res, error => { throw error; });
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /awaiting outlet verification/i);
    assert.equal(settingsRead, false);
  } finally { Order.findById = originals.orderFindById; Payment.findOne = originals.paymentFindOne; RestaurantSettings.getSettings = originals.settings; }
});

test('UPI resume refuses payment for an order that is already paid', async () => {
  const originals = { orderFindById: Order.findById, paymentFindOne: Payment.findOne, settings: RestaurantSettings.getSettings };
  let paymentLookup = false;
  Order.findById = async id => ({ _id: id, userId: '64b000000000000000000002', orderStatus: 'PLACED', paymentStatus: 'SUCCESS', paymentMethod: 'UPI_QR' });
  Payment.findOne = () => { paymentLookup = true; return { select: async () => null }; };
  try {
    const { getUpiInstructions } = require('../src/controllers/manualPaymentController');
    const res = response();
    await getUpiInstructions({ params: { orderId: '64b000000000000000000001' }, user: { _id: '64b000000000000000000002' } }, res, error => { throw error; });
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /already paid/i);
    assert.equal(paymentLookup, false);
  } finally { Order.findById = originals.orderFindById; Payment.findOne = originals.paymentFindOne; RestaurantSettings.getSettings = originals.settings; }
});
