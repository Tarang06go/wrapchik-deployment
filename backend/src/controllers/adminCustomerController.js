const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');
const CustomerAccountAudit = require('../models/CustomerAccountAudit');
const socketManager = require('../config/socketManager');

const listCustomers = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 30));
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 80) : '';
    const filter = { role: 'student' };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ name: { $regex: escaped, $options: 'i' } }, { email: { $regex: escaped, $options: 'i' } }];
    }
    const [customers, total] = await Promise.all([
      User.find(filter).select('_id name email isActive createdAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(filter),
    ]);
    const ids = customers.map((customer) => customer._id);
    const stats = await Order.aggregate([
      { $match: { userId: { $in: ids }, paymentStatus: 'SUCCESS', orderStatus: { $nin: ['CANCELLED', 'REJECTED'] } } },
      { $group: { _id: '$userId', orderCount: { $sum: 1 }, spend: { $sum: '$totalAmount' }, lastOrderAt: { $max: '$createdAt' } } },
    ]);
    const byId = new Map(stats.map((row) => [String(row._id), row]));
    res.json({ success: true, page, limit, total, customers: customers.map((customer) => {
      const row = byId.get(String(customer._id));
      return { ...customer, isActive: customer.isActive !== false, orderCount: row?.orderCount || 0, verifiedSpend: row?.spend || 0, lastOrderAt: row?.lastOrderAt || null };
    }) });
  } catch (error) { next(error); }
};

const setCustomerActive = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'A valid customer is required.' });
    if (typeof req.body?.isActive !== 'boolean') return res.status(400).json({ success: false, message: 'isActive must be a boolean.' });
    const customer = await User.findOne({ _id: req.params.id, role: 'student' });
    if (!customer) return res.status(404).json({ success: false, message: 'Student account not found.' });
    const previousActive = customer.isActive !== false;
    const nextActive = req.body.isActive;
    if (previousActive === nextActive) return res.json({ success: true, isActive: nextActive, changed: false });
    customer.isActive = nextActive;
    await customer.save();
    try {
      await CustomerAccountAudit.create({ actorId: req.user._id, targetUserId: customer._id, previousActive, nextActive });
    } catch (auditError) {
      customer.isActive = previousActive;
      await customer.save().catch(() => {});
      throw auditError;
    }
    if (!nextActive) socketManager.disconnectUserSockets(customer._id);
    res.json({ success: true, isActive: nextActive, changed: true });
  } catch (error) { next(error); }
};

module.exports = { listCustomers, setCustomerActive };
