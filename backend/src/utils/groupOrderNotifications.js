const notifyJoinedGroupMembers = async ({
  members,
  title,
  message,
  type = 'SYSTEM',
  orderId = null,
  dedupePrefix,
  excludeUserId = null,
  createNotification,
}) => {
  if (typeof createNotification !== 'function' || !dedupePrefix) return [];
  const excluded = excludeUserId == null ? null : String(excludeUserId);
  const recipients = [...new Set((Array.isArray(members) ? members : [])
    .filter(member => member?.status === 'JOINED' && member.userId != null)
    .map(member => String(member.userId?._id || member.userId))
    .filter(userId => userId && userId !== excluded))];
  return Promise.all(recipients.map(userId => createNotification(
    userId,
    title,
    message,
    type,
    orderId,
    `${dedupePrefix}:${userId}`,
  )));
};

module.exports = { notifyJoinedGroupMembers };
