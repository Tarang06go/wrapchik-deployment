const mongoose = require('mongoose');

const customerAccountAuditSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  previousActive: { type: Boolean, required: true },
  nextActive: { type: Boolean, required: true },
  createdAt: { type: Date, default: Date.now, immutable: true },
}, { versionKey: false });

customerAccountAuditSchema.index({ targetUserId: 1, createdAt: -1 });

module.exports = mongoose.model('CustomerAccountAudit', customerAccountAuditSchema);
