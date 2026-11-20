const ACTIVE_MEMBER_COUNT = {
  $size: {
    $filter: {
      input: { $ifNull: ['$members', []] },
      as: 'member',
      cond: { $eq: ['$$member.status', 'JOINED'] },
    },
  },
};

const getActiveMembers = (members = []) => members.filter((member) => member.status === 'JOINED');
const countActiveMembers = (members = []) => getActiveMembers(members).length;

const chooseNextLeader = (members = [], departingUserId) => {
  const departingId = String(departingUserId);
  return members
    .map((member, index) => ({ member, index }))
    .filter(({ member }) => member.status === 'JOINED' && String(member.userId?._id || member.userId) !== departingId)
    .sort((left, right) => {
      const leftTime = new Date(left.member.joinedAt || 0).getTime();
      const rightTime = new Date(right.member.joinedAt || 0).getTime();
      return leftTime - rightTime || left.index - right.index;
    })[0]?.member || null;
};

const isGroupExpired = (group, now = new Date()) => Boolean(group?.expiresAt && new Date(group.expiresAt).getTime() <= now.getTime());

module.exports = { ACTIVE_MEMBER_COUNT, getActiveMembers, countActiveMembers, chooseNextLeader, isGroupExpired };
