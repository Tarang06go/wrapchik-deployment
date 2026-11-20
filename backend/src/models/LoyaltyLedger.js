const mongoose = require('mongoose');

const loyaltyLedgerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  type: { type: String, enum: ['EARN', 'REDEEM', 'REDEEM_RELEASE'], required: true },
  pointsDelta: { type: Number, required: true, validate: Number.isInteger },
  amountPaise: { type: Number, default: 0, min: 0, validate: Number.isInteger },
}, { timestamps: true });

loyaltyLedgerSchema.index({ orderId: 1, type: 1 }, { unique: true, name: 'loyalty_order_entry_once' });
loyaltyLedgerSchema.index({ userId: 1, createdAt: -1 }, { name: 'loyalty_user_history' });

module.exports = mongoose.model('LoyaltyLedger', loyaltyLedgerSchema);
