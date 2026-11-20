const mongoose = require('mongoose');

const orderReviewSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
  comment: { type: String, trim: true, maxlength: 500, default: '' },
}, { timestamps: true });

orderReviewSchema.index({ orderId: 1, userId: 1 }, { unique: true, name: 'one_review_per_order_customer' });
orderReviewSchema.index({ createdAt: -1 });

module.exports = mongoose.model('OrderReview', orderReviewSchema);
