const normalizeId = value => String(value?._id || value || '');

const summarizeGroup = (group, viewerId) => {
  const viewerKey = normalizeId(viewerId);
  const member = (group.members || []).find(row => normalizeId(row.userId) === viewerKey);
  const activeMembers = (group.members || []).filter(row => row.status === 'JOINED');
  const contributions = group.contributions || [];
  const order = group.orderId && typeof group.orderId === 'object' ? group.orderId : null;
  const contributionCounts = {
    verified: contributions.filter(row => row.status === 'SUCCESS').length,
    awaitingVerification: contributions.filter(row => row.status === 'CLAIMED').length,
    pending: contributions.filter(row => row.status === 'PENDING').length,
    total: contributions.length,
  };
  let paymentStatus = 'NOT_STARTED';
  if (group.paymentVerifiedAt || order?.paymentStatus === 'SUCCESS') paymentStatus = 'VERIFIED';
  else if (contributionCounts.awaitingVerification) paymentStatus = contributionCounts.verified ? 'PARTIAL_REVIEW' : 'AWAITING_VERIFICATION';
  else if (contributionCounts.verified) paymentStatus = 'PARTIAL';
  else if (contributionCounts.pending) paymentStatus = 'PENDING';
  else if (group.status === 'ORDERED') paymentStatus = 'AWAITING_SETUP';

  const ownContribution = contributions.find(row => normalizeId(row.userId) === viewerKey);
  const isLeader = normalizeId(group.leaderId) === viewerKey;
  const membershipStatus = member?.status || (isLeader ? 'JOINED' : 'LEFT');
  const groupCode = String(group.groupCode || '');
  return {
    _id: normalizeId(group),
    name: String(group.name || '').trim() || `Share a Meal · ${groupCode}`,
    groupCode,
    status: group.status,
    orderStatus: order?.orderStatus || null,
    orderNumber: order?.orderNumber || null,
    paymentStatus,
    contributionCounts,
    viewerContributionStatus: ownContribution?.status || (group.checkoutMode === 'HOST_PAYS' && !isLeader ? 'NOT_REQUIRED' : 'NOT_STARTED'),
    memberCount: activeMembers.length,
    maxMembers: group.maxMembers || 8,
    membershipStatus,
    isLeader,
    orderId: order ? normalizeId(order) : normalizeId(group.orderId) || null,
    checkoutMode: group.checkoutMode || null,
    expiresAt: group.expiresAt || null,
    updatedAt: group.updatedAt || group.createdAt || null,
    createdAt: group.createdAt || null,
  };
};

const isGroupHistory = group => group.membershipStatus !== 'JOINED'
  || ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(group.status)
  || ['COMPLETED', 'PICKED_UP', 'DELIVERED', 'SERVED', 'CANCELLED', 'REJECTED'].includes(group.orderStatus);

module.exports = { summarizeGroup, isGroupHistory };
