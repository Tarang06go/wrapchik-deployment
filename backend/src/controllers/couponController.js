const Coupon = require('../models/Coupon');
const { previewCoupon } = require('../utils/couponPricing');
const { calculateVerifiedItems } = require('../utils/orderPricing');
const { isCouponScheduleActive } = require('../utils/couponSchedule');

const validateCoupon = async (req, res, next) => {
  try {
    const { code, items } = req.body || {};
    if (!Array.isArray(items) || !items.length || items.length > 50) return res.status(400).json({ success: false, message: 'A valid cart is required to check coupon eligibility.' });
    for (const item of items) {
      if (!item || typeof item.productId !== 'string' || !/^[a-f\d]{24}$/i.test(item.productId) || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 50) return res.status(400).json({ success: false, message: 'Cart item data is invalid.' });
    }
    const pricing = await calculateVerifiedItems(items);
    const quote = await previewCoupon(code, req.user._id, pricing.subtotal);
    const netSubtotal = Math.max(0, pricing.subtotal - quote.discountAmount);
    const taxAndFees = Math.round(netSubtotal * 0.05);
    const settings = await require('../models/RestaurantSettings').getSettings();
    const orderType = req.body.orderType || 'TAKEAWAY';
    if (!['TAKEAWAY', 'DELIVERY', 'DINE_IN'].includes(orderType)) return res.status(400).json({ success: false, message: 'Order type is invalid.' });
    const deliveryFee = orderType === 'DELIVERY' ? settings.deliveryFee : 0;
    const totalAmount = netSubtotal + taxAndFees + deliveryFee;
    if (totalAmount <= 0) return res.status(400).json({ success: false, message: 'This coupon cannot reduce an order total to zero.' });
    return res.json({ success: true, quote: { ...quote, subtotal: pricing.subtotal, orderType, taxAndFees, deliveryFee, totalAmount } });
  } catch (error) { return next(error); }
};

const getCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().select('-redemptions').sort({ createdAt: -1 }).lean();
    res.json({ success: true, coupons });
  } catch (error) { next(error); }
};

const getAvailableCoupons = async (req, res, next) => {
  try {
    const now = new Date();
    const coupons = await Coupon.find({ active: true, startsAt: { $lte: now }, expiresAt: { $gt: now }, $expr: { $lt: ['$redemptionCount', '$usageLimit'] } })
      .select('code description discountType discountValue minOrderValue maxDiscountAmount expiresAt studentOnly activeDays activeHours perCustomerLimit redemptions')
      .sort({ expiresAt: 1 }).lean();
    const eligible = coupons.filter(coupon => {
      if (!isCouponScheduleActive(coupon, now)) return false;
      if (coupon.studentOnly && (req.user?.role !== 'student' || req.user?.emailVerified !== true || !/@thapar\.edu$/i.test(String(req.user?.email || '')))) return false;
      const used = (coupon.redemptions || []).filter(entry => String(entry.userId) === String(req.user?._id)).length;
      return used < (coupon.perCustomerLimit || 1);
    }).map(({ redemptions, ...coupon }) => coupon);
    res.json({ success: true, coupons: eligible });
  } catch (error) { next(error); }
};

const validateCouponInput = body => {
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
  const discountType = body.discountType;
  const discountValue = Number(body.discountValue);
  const minOrderValue = Number(body.minOrderValue ?? 0);
  const maxDiscountAmount = body.maxDiscountAmount === '' || body.maxDiscountAmount == null ? null : Number(body.maxDiscountAmount);
  const usageLimit = Number(body.usageLimit);
  const perCustomerLimit = Number(body.perCustomerLimit ?? 1);
  const studentOnly = body.studentOnly === undefined ? false : body.studentOnly;
  const activeDays = body.activeDays === undefined ? [] : body.activeDays;
  const rawHours = body.activeHours;
  const startsAt = new Date(body.startsAt);
  const expiresAt = new Date(body.expiresAt);
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw Object.assign(new Error('Coupon code must be 3–32 letters, numbers, hyphens or underscores.'), { statusCode: 400 });
  if (!['PERCENT', 'FIXED'].includes(discountType) || !Number.isFinite(discountValue) || discountValue <= 0 || (discountType === 'PERCENT' && discountValue > 100)) throw Object.assign(new Error('Discount type or value is invalid.'), { statusCode: 400 });
  if (!Number.isFinite(minOrderValue) || minOrderValue < 0 || (maxDiscountAmount !== null && (!Number.isFinite(maxDiscountAmount) || maxDiscountAmount <= 0))) throw Object.assign(new Error('Minimum order or maximum discount is invalid.'), { statusCode: 400 });
  if (!Number.isInteger(usageLimit) || usageLimit < 1 || usageLimit > 10000 || !Number.isInteger(perCustomerLimit) || perCustomerLimit < 1 || perCustomerLimit > 100) throw Object.assign(new Error('Usage limits are invalid.'), { statusCode: 400 });
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(expiresAt.getTime()) || expiresAt <= startsAt) throw Object.assign(new Error('Coupon dates are invalid.'), { statusCode: 400 });
  if (typeof studentOnly !== 'boolean') throw Object.assign(new Error('studentOnly must be a boolean.'), { statusCode: 400 });
  if (!Array.isArray(activeDays) || activeDays.length > 7 || activeDays.some(day => !Number.isInteger(day) || day < 0 || day > 6) || new Set(activeDays).size !== activeDays.length) throw Object.assign(new Error('Active days must contain unique weekday numbers from 0 to 6.'), { statusCode: 400 });
  let activeHours = null;
  if (rawHours != null && (rawHours.start || rawHours.end)) {
    if (typeof rawHours.start !== 'string' || typeof rawHours.end !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(rawHours.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(rawHours.end) || rawHours.start === rawHours.end) throw Object.assign(new Error('Set a valid start and end time (HH:mm) for the offer window.'), { statusCode: 400 });
    activeHours = { start: rawHours.start, end: rawHours.end };
  }
  return { code, description: String(body.description || '').trim().slice(0, 240), discountType, discountValue, minOrderValue, maxDiscountAmount, usageLimit, perCustomerLimit, startsAt, expiresAt, studentOnly, activeDays: [...activeDays].sort((a, b) => a - b), activeHours };
};

const createCoupon = async (req, res, next) => {
  try {
    const input = validateCouponInput(req.body || {});
    if (req.body?.active !== undefined && typeof req.body.active !== 'boolean') return res.status(400).json({ success: false, message: 'active must be a boolean.' });
    const coupon = await Coupon.create({ ...input, ...(req.body?.active !== undefined ? { active: req.body.active } : {}) });
    res.status(201).json({ success: true, coupon: coupon.toObject({ transform: (doc, ret) => { delete ret.redemptions; return ret; } }) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Coupon code already exists.' });
    next(error);
  }
};

const updateCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found.' });
    const input = validateCouponInput({ ...coupon.toObject(), ...req.body, code: req.body.code ?? coupon.code, discountType: req.body.discountType ?? coupon.discountType, discountValue: req.body.discountValue ?? coupon.discountValue, startsAt: req.body.startsAt ?? coupon.startsAt, expiresAt: req.body.expiresAt ?? coupon.expiresAt, usageLimit: req.body.usageLimit ?? coupon.usageLimit, minOrderValue: req.body.minOrderValue ?? coupon.minOrderValue });
    if (input.usageLimit < coupon.redemptionCount) return res.status(409).json({ success: false, message: 'Usage limit cannot be lower than already reserved or redeemed uses.' });
    Object.assign(coupon, input);
    if (req.body.active !== undefined) {
      if (typeof req.body.active !== 'boolean') return res.status(400).json({ success: false, message: 'active must be a boolean.' });
      coupon.active = req.body.active;
    }
    await coupon.save();
    const result = coupon.toObject(); delete result.redemptions;
    res.json({ success: true, coupon: result });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Coupon code already exists.' });
    next(error);
  }
};

module.exports = { validateCoupon, getCoupons, getAvailableCoupons, createCoupon, updateCoupon, validateCouponInput };
