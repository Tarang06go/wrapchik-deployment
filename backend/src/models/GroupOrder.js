const mongoose = require('mongoose');

const groupMemberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['JOINED', 'LEFT'], default: 'JOINED' },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date, default: null },
});

const groupAllocationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  percentageBps: { type: Number, required: true, min: 1, max: 10_000 },
  amountPaise: { type: Number, required: true, min: 0 },
  acceptedRevision: { type: Number, default: null },
  acceptedAt: { type: Date, default: null },
}, { _id: false });

const groupItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  selectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  priceAtPurchase: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1, max: 50 },
  customizations: [{ name: { type: String, required: true }, price: { type: Number, required: true, min: 0 } }],
  itemTotalPaise: { type: Number, required: true, min: 0 },
  shareMode: { type: String, enum: ['SOLO', 'SHARED'], default: 'SOLO' },
  allocations: { type: [groupAllocationSchema], default: [] },
  revision: { type: Number, default: 1, min: 1 },
}, { timestamps: true });

const groupContributionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amountPaise: { type: Number, required: true, min: 0 },
  method: { type: String, enum: ['UPI_QR', 'COUNTER'], required: true },
  status: { type: String, enum: ['PENDING', 'CLAIMED', 'SUCCESS'], default: 'PENDING' },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
  upiTransactionReference: { type: String, default: null, maxlength: 120 },
  verificationReason: { type: String, default: null, maxlength: 500 },
  submittedAt: { type: Date, default: null },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  verifiedAt: { type: Date, default: null },
}, { timestamps: true });

const groupMemberShareSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amountPaise: { type: Number, required: true, min: 0 },
}, { _id: false });

const groupOrderSchema = new mongoose.Schema(
  {
    groupCode: { type: String, required: true, unique: true, uppercase: true },
    name: { type: String, trim: true, maxlength: 48, default: 'Share a Meal' },
    leaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [groupMemberSchema],
    items: { type: [groupItemSchema], default: [] },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    checkoutMode: { type: String, enum: ['SPLIT', 'HOST_PAYS', null], default: null },
    paymentMethod: { type: String, enum: ['UPI_QR', 'COUNTER', null], default: null },
    memberShares: { type: [groupMemberShareSchema], default: [] },
    contributions: { type: [groupContributionSchema], default: [] },
    paymentVerifiedAt: { type: Date, default: null },
    status: { type: String, enum: ['OPEN', 'LOCKED', 'ORDERED', 'COMPLETED', 'CANCELLED'], default: 'OPEN' },
    orderType: { type: String, enum: ['DELIVERY', 'TAKEAWAY', 'DINE_IN'], default: 'TAKEAWAY' },
    hostel: { type: String, default: null },
    roomNumber: { type: String, default: null },
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', default: null },
    maxMembers: { type: Number, default: 8, min: 2 },
    expiresAt: { type: Date, default: null },
    lockedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    paymentReminderLastSentAt: { type: Date, default: null },
    paymentReminderCount: { type: Number, default: 0, min: 0, max: 6 },
  },
  { timestamps: true, optimisticConcurrency: true }
);

groupOrderSchema.index({ status: 1, createdAt: -1 }, { name: 'group_status_created' });
groupOrderSchema.index({ 'members.userId': 1, updatedAt: -1 }, { name: 'group_member_updated' });

module.exports = mongoose.model('GroupOrder', groupOrderSchema);
