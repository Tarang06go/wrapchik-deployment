const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Order = require('../src/models/Order');
const OrderReview = require('../src/models/OrderReview');
const { getOrderReview, createOrderReview } = require('../src/controllers/reviewController');

const originalOrderFindOne = Order.findOne;
const originalReviewFindOne = OrderReview.findOne;
const originalReviewCreate = OrderReview.create;
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const customerId = new mongoose.Types.ObjectId();
const orderId = new mongoose.Types.ObjectId();
let order;

test.beforeEach(() => {
  order = { _id: orderId, orderStatus: 'COMPLETED', paymentStatus: 'SUCCESS' };
  Order.findOne = () => ({ select: async () => order });
  OrderReview.findOne = () => ({ lean: async () => null });
});
test.afterEach(() => {
  Order.findOne = originalOrderFindOne;
  OrderReview.findOne = originalReviewFindOne;
  OrderReview.create = originalReviewCreate;
});

test('review access requires a completed order with confirmed payment', async () => {
  const responseOne = response();
  order.orderStatus = 'PREPARING';
  await getOrderReview({ params: { orderId: String(orderId) }, user: { _id: customerId } }, responseOne, error => { throw error; });
  assert.equal(responseOne.statusCode, 409);
  const responseTwo = response();
  order.orderStatus = 'COMPLETED'; order.paymentStatus = 'PENDING';
  await createOrderReview({ params: { orderId: String(orderId) }, user: { _id: customerId, role: 'student' }, body: { rating: 5 } }, responseTwo, error => { throw error; });
  assert.equal(responseTwo.statusCode, 409);
});

test('only the owning student can create one validated review for a paid completed order', async () => {
  let saved;
  OrderReview.create = async value => { saved = value; return { ...value, _id: 'review-1' }; };
  const result = response();
  await createOrderReview({ params: { orderId: String(orderId) }, user: { _id: customerId, role: 'student' }, body: { rating: 4, comment: '  Great lunch  ' } }, result, error => { throw error; });
  assert.equal(result.statusCode, 201);
  assert.equal(saved.rating, 4);
  assert.equal(saved.comment, 'Great lunch');
  assert.equal(String(saved.userId), String(customerId));
});

test('reviews reject invalid input, administrator authorship and duplicate submissions', async () => {
  const invalid = response();
  await createOrderReview({ params: { orderId: String(orderId) }, user: { _id: customerId, role: 'student' }, body: { rating: 6 } }, invalid, error => { throw error; });
  assert.equal(invalid.statusCode, 400);
  const admin = response();
  await createOrderReview({ params: { orderId: String(orderId) }, user: { _id: customerId, role: 'admin' }, body: { rating: 5 } }, admin, error => { throw error; });
  assert.equal(admin.statusCode, 403);
  OrderReview.create = async () => { throw Object.assign(new Error('duplicate'), { code: 11000 }); };
  const duplicate = response();
  await createOrderReview({ params: { orderId: String(orderId) }, user: { _id: customerId, role: 'student' }, body: { rating: 5 } }, duplicate, error => { throw error; });
  assert.equal(duplicate.statusCode, 409);
});
