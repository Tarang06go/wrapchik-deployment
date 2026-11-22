const mongoose = require('mongoose');

const groupActivitySchema = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupOrder', required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  actorName: { type: String, trim: true, maxlength: 48, default: 'Group member' },
  type: {
    type: String,
    enum: [
      'GROUP_CREATED', 'MEMBER_JOINED', 'MEMBER_LEFT', 'MEMBER_REMOVED', 'GROUP_LOCKED',
      'CART_ITEM_ADDED', 'CART_ITEM_UPDATED', 'CART_ITEM_REMOVED', 'SHARE_CHANGED', 'SHARE_ACCEPTED',
      'ORDER_PLACED', 'CONTRIBUTION_VERIFIED', 'PAYMENT_CLAIM_REJECTED', 'GROUP_PAYMENT_VERIFIED',
      'PAYMENT_REMINDER', 'GROUP_EXPIRED', 'GROUP_CANCELLED', 'ORDER_STATUS_CHANGED', 'PICKUP_COMPLETED',
    ],
    required: true,
  },
  message: { type: String, required: true, trim: true, maxlength: 160 },
}, { timestamps: { createdAt: true, updatedAt: false } });

groupActivitySchema.index({ groupId: 1, createdAt: -1 }, { name: 'group_activity_recent' });

module.exports = mongoose.model('GroupActivity', groupActivitySchema);
