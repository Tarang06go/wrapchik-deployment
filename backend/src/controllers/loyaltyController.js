const User = require('../models/User');
const RestaurantSettings = require('../models/RestaurantSettings');
const LoyaltyLedger = require('../models/LoyaltyLedger');
const { calculateVerifiedItems } = require('../utils/orderPricing');
const { previewCoupon } = require('../utils/couponPricing');
const { loyaltyPolicyReady, loyaltyRedemptionReady, quoteLoyaltyRedemption, loyaltyTierForLifetimePoints } = require('../utils/loyaltyRules');

const requireStudent = (req, res) => {
  if (req.user?.role === 'student') return true;
  res.status(403).json({ success: false, message: 'Loyalty rewards are available to student customers.' });
  return false;
};

const getMyLoyalty = async (req, res, next) => {
  try {
    if (!requireStudent(req, res)) return;
    const [user, settings, entries] = await Promise.all([
      User.findById(req.user._id).select('loyaltyPointsBalance loyaltyLifetimePoints'),
      RestaurantSettings.getSettings(),
      LoyaltyLedger.find({ userId: req.user._id }).select('orderId type pointsDelta amountPaise createdAt').sort({ createdAt: -1 }).limit(30).lean(),
    ]);
    if (!user) return res.status(404).json({ success: false, message: 'Customer account not found.' });
    const balance = Number(user.loyaltyPointsBalance) || 0;
    const lifetimePoints = Number(user.loyaltyLifetimePoints) || 0;
    const policy = settings.loyalty || {};
    return res.json({ success: true, rewards: {
      earningEnabled: loyaltyPolicyReady(policy),
      redemptionEnabled: loyaltyRedemptionReady(policy),
      pointsBalance: balance,
      lifetimePoints,
      tier: loyaltyTierForLifetimePoints(policy.tiers, lifetimePoints),
      policy: { earnEveryRupees: policy.earnEveryRupees || 0, pointsPerStep: policy.pointsPerStep || 0, paisePerPoint: policy.paisePerPoint || 0, minimumRedemptionPoints: policy.minimumRedemptionPoints || 0, maxRedemptionPercent: policy.maxRedemptionPercent || 0, tiers: policy.tiers || [] },
      history: entries,
    } });
  } catch (error) { return next(error); }
};

const quoteLoyalty = async (req, res, next) => {
  try {
    if (!requireStudent(req, res)) return;
    const { items, orderType = 'TAKEAWAY', couponCode = '', points = 0 } = req.body || {};
    if (!Array.isArray(items) || items.length < 1 || items.length > 50) return res.status(400).json({ success: false, message: 'A valid cart is required to quote reward points.' });
    if (!['TAKEAWAY', 'DELIVERY', 'DINE_IN'].includes(orderType)) return res.status(400).json({ success: false, message: 'Order type is invalid.' });
    if (typeof couponCode !== 'string' || couponCode.length > 32) return res.status(400).json({ success: false, message: 'Coupon code is invalid.' });
    for (const item of items) {
      if (!item || typeof item.productId !== 'string' || !/^[a-f\d]{24}$/i.test(item.productId) || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 50) return res.status(400).json({ success: false, message: 'Cart item data is invalid.' });
    }
    const [pricing, user, settings] = await Promise.all([
      calculateVerifiedItems(items),
      User.findById(req.user._id).select('loyaltyPointsBalance'),
      RestaurantSettings.getSettings(),
    ]);
    if (!user) return res.status(404).json({ success: false, message: 'Customer account not found.' });
    const coupon = couponCode.trim() ? await previewCoupon(couponCode, req.user._id, pricing.subtotal) : { discountAmount: 0, code: '' };
    const subtotalPaise = Math.round(pricing.subtotal * 100);
    const couponDiscountPaise = Math.round(coupon.discountAmount * 100);
    const eligibleSubtotalPaise = Math.max(0, subtotalPaise - couponDiscountPaise);
    const redemption = quoteLoyaltyRedemption({ policy: settings.loyalty, points: Number(points), balance: Number(user.loyaltyPointsBalance) || 0, eligibleSubtotalPaise });
    const netSubtotal = (eligibleSubtotalPaise - redemption.discountPaise) / 100;
    const taxAndFees = Math.round(netSubtotal * 0.05);
    const deliveryFee = orderType === 'DELIVERY' ? Number(settings.deliveryFee) || 0 : 0;
    const totalAmount = netSubtotal + taxAndFees + deliveryFee;
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) return res.status(400).json({ success: false, message: 'The quote must keep a positive amount payable.' });
    return res.json({ success: true, quote: {
      subtotal: pricing.subtotal, couponCode: coupon.code, couponDiscountAmount: coupon.discountAmount,
      points: redemption.points, loyaltyDiscountAmount: redemption.discountPaise / 100,
      pointsBalance: Number(user.loyaltyPointsBalance) || 0, maximumPoints: redemption.maximumPoints,
      taxAndFees, deliveryFee, totalAmount,
    } });
  } catch (error) { return next(error); }
};

module.exports = { getMyLoyalty, quoteLoyalty };
