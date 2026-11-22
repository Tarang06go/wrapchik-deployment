const GroupActivity = require('../models/GroupActivity');
const mongoose = require('mongoose');

const recordGroupActivity = ({ groupId, actorId = null, actorName = 'Group member', type, message, createdAt = new Date() }) => {
  if (!groupId || !type || !message) return;
  // This feed is supplementary. Start the write but never make ordering or payment
  // actions wait for an activity insert / MongoDB buffer timeout.
  const safeActorId = mongoose.isValidObjectId(actorId) ? actorId : null;
  Promise.resolve().then(() => GroupActivity.create({
      groupId,
      actorId: safeActorId,
      actorName: String(actorName || 'Group member').trim().slice(0, 48),
      type,
      message: String(message).trim().slice(0, 160),
      createdAt,
    })).catch(error => {
      console.error('[Group Activity] Could not save activity event:', error.message);
    });
};

module.exports = { recordGroupActivity };
