const idOf = (value) => String(value && typeof value === 'object' ? value._id || '' : value || '');

export const deriveGroupRole = (group, userId) => {
  const currentUserId = idOf(userId);
  return {
    isLeader: Boolean(currentUserId && idOf(group?.leaderId) === currentUserId),
    isMember: Boolean(currentUserId && group?.members?.some((member) => (
      member.status === 'JOINED' && idOf(member.userId) === currentUserId
    ))),
  };
};
