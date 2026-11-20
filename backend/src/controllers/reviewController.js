const mongoose = require('mongoose');
const Order = require('../models/Order');
const OrderReview = require('../models/OrderReview');

const completedAndPaid = order => Boolean(order && order.paymentStatus === 'SUCCESS'
  && ['COMPLETED', 'PICKED_UP', 'DELIVERED', 'SERVED'].includes(order.orderStatus));

const getOrderReview = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.orderId)) return res.status(400).json({ success: false, message: 'A valid order is required.' });
    const order = await Order.findOne({ _id: req.params.orderId, userId: req.user._id }).select('_id orderStatus paymentStatus');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (!completedAndPaid(order)) return res.status(409).json({ success: false, message: 'Only a paid, completed order can be reviewed.' });
    const review = await OrderReview.findOne({ orderId: order._id, userId: req.user._id }).lean();
    return res.json({ success: true, review: review || null });
  } catch (error) { return next(error); }
};

const createOrderReview = async (req, res, next) => {
  try {
    if (req.user?.role !== 'student') return res.status(403).json({ success: false, message: 'Only student customers can review orders.' });
    if (!mongoose.isValidObjectId(req.params.orderId)) return res.status(400).json({ success: false, message: 'A valid order is required.' });
    const rating = Number(req.body?.rating);
    const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 500) return res.status(400).json({ success: false, message: 'Choose a whole-number rating from 1 to 5 and keep the comment within 500 characters.' });
    const order = await Order.findOne({ _id: req.params.orderId, userId: req.user._id }).select('_id orderStatus paymentStatus');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (!completedAndPaid(order)) return res.status(409).json({ success: false, message: 'Only a paid, completed order can be reviewed.' });
    const review = await OrderReview.create({ orderId: order._id, userId: req.user._id, rating, comment });
    return res.status(201).json({ success: true, review });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'This completed order already has a review.' });
    return next(error);
  }
};

module.exports = { completedAndPaid, getOrderReview, createOrderReview };
