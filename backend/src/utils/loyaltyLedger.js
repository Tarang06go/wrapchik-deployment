const Order = require('../models/Order');
const User = require('../models/User');
const LoyaltyLedger = require('../models/LoyaltyLedger');
const { earnedPointsForOrder } = require('./loyaltyRules');

const reserveLoyaltyRedemption = async ({ userId, orderId, points, discountPaise }) => {
  if (!points) return null;
  const user = await User.findOneAndUpdate(
    { _id: userId, role: 'student', isActive: { $ne: false }, loyaltyPointsBalance: { $gte: points } },
    { $inc: { loyaltyPointsBalance: -points } },
    { new: true, runValidators: true },
  );
  if (!user) throw Object.assign(new Error('Reward points changed or are insufficient. Refresh your balance and try again.'), { statusCode: 409 });
  try {
    await LoyaltyLedger.create({ userId, orderId, type: 'REDEEM', pointsDelta: -points, amountPaise: discountPaise });
    return { points, discountAmount: discountPaise / 100 };
  } catch (error) {
    await User.updateOne({ _id: userId }, { $inc: { loyaltyPointsBalance: points } }).catch(() => {});
    throw error;
  }
};

const rollbackLoyaltyReservation = async ({ userId, orderId, points, discountPaise }) => {
  if (!points) return false;
  const existing = await LoyaltyLedger.exists({ orderId, type: 'REDEEM_RELEASE' });
  if (existing) return false;
  await User.updateOne({ _id: userId }, { $inc: { loyaltyPointsBalance: points } });
  try {
    await LoyaltyLedger.create({ userId, orderId, type: 'REDEEM_RELEASE', pointsDelta: points, amountPaise: discountPaise });
    return true;
  } catch (error) {
    await User.updateOne({ _id: userId }, { $inc: { loyaltyPointsBalance: -points } }).catch(() => {});
    if (error.code === 11000) return false;
    throw error;
  }
};

const releaseLoyaltyRedemption = async order => {
  const points = Number(order?.loyaltyPointsRedeemed) || 0;
  if (!order?._id || !order?.userId || points <= 0 || order.loyaltyPointsReleased) return false;
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, loyaltyPointsRedeemed: points, loyaltyPointsReleased: { $ne: true }, orderStatus: { $in: ['CANCELLED', 'REJECTED'] }, paymentStatus: { $ne: 'SUCCESS' } },
    { $set: { loyaltyPointsReleased: true } },
    { new: true },
  );
  if (!claimed) return false;
  const userId = claimed.userId?._id || claimed.userId;
  try {
    await User.updateOne({ _id: userId }, { $inc: { loyaltyPointsBalance: points } });
    await LoyaltyLedger.create({ userId, orderId: claimed._id, type: 'REDEEM_RELEASE', pointsDelta: points, amountPaise: Math.round(Number(claimed.loyaltyDiscountAmount || 0) * 100) });
    return true;
  } catch (error) {
    await User.updateOne({ _id: userId }, { $inc: { loyaltyPointsBalance: -points } }).catch(() => {});
    await Order.updateOne({ _id: claimed._id, loyaltyPointsReleased: true }, { $set: { loyaltyPointsReleased: false } }).catch(() => {});
    if (error.code === 11000) return false;
    throw error;
  }
};

const awardLoyaltyForCompletedOrder = async (order, policy) => {
  if (!order?._id || order.groupOrderId || order.paymentStatus !== 'SUCCESS'
    || !['COMPLETED', 'PICKED_UP', 'DELIVERED', 'SERVED'].includes(order.orderStatus)) return 0;
  const eligibleSpendPaise = Math.max(0, Math.round((Number(order.subtotal || 0)
    - Number(order.discountAmount || 0) - Number(order.loyaltyDiscountAmount || 0)) * 100));
  const orderPolicy = Number.isInteger(order.loyaltyEarnEveryRupeesSnapshot) && order.loyaltyEarnEveryRupeesSnapshot > 0
    && Number.isInteger(order.loyaltyPointsPerStepSnapshot) && order.loyaltyPointsPerStepSnapshot > 0
    ? { enabled: true, earnEveryRupees: order.loyaltyEarnEveryRupeesSnapshot, pointsPerStep: order.loyaltyPointsPerStepSnapshot }
    : null;
  const points = earnedPointsForOrder({ policy: orderPolicy, eligibleSpendPaise });
  if (!points) return 0;
  const claimFilter = { _id: order._id, paymentStatus: 'SUCCESS', orderStatus: { $in: ['COMPLETED', 'PICKED_UP', 'DELIVERED', 'SERVED'] }, loyaltyPointsEarned: { $in: [0, null] } };
  const claimed = await Order.findOneAndUpdate(claimFilter, { $set: { loyaltyPointsEarned: points } }, { new: true });
  if (!claimed) return 0;
  const userId = claimed.userId?._id || claimed.userId;
  try {
    await User.updateOne({ _id: userId, role: 'student' }, { $inc: { loyaltyPointsBalance: points, loyaltyLifetimePoints: points } });
    await LoyaltyLedger.create({ userId, orderId: claimed._id, type: 'EARN', pointsDelta: points, amountPaise: eligibleSpendPaise });
    return points;
  } catch (error) {
    await User.updateOne({ _id: userId }, { $inc: { loyaltyPointsBalance: -points, loyaltyLifetimePoints: -points } }).catch(() => {});
    await Order.updateOne({ _id: claimed._id, loyaltyPointsEarned: points }, { $set: { loyaltyPointsEarned: 0 } }).catch(() => {});
    if (error.code === 11000) return 0;
    throw error;
  }
};

module.exports = { reserveLoyaltyRedemption, rollbackLoyaltyReservation, releaseLoyaltyRedemption, awardLoyaltyForCompletedOrder };
