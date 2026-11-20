let io = null;

const init = (socketIo) => {
  io = socketIo;
};

const getIO = () => io;
const disconnectUserSockets = (userId) => {
  if (io) io.in(`user_${userId}`).disconnectSockets(true);
};

const emitOrderUpdate = (order) => {
  if (!io) return;
  const userId = order.userId?._id || order.userId;
  io.to(`user_${userId}`).emit('order_updated', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    orderType: order.orderType,
    paymentStatus: order.paymentStatus,
    acceptedAt: order.acceptedAt,
    preparingAt: order.preparingAt,
    readyAt: order.readyAt,
    completedAt: order.completedAt,
    pickedUpAt: order.pickedUpAt,
    deliveredAt: order.deliveredAt,
    servedAt: order.servedAt,
    rejectedAt: order.rejectedAt,
    cancelledAt: order.cancelledAt,
  });
  io.to('admin').emit('order_updated', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    orderType: order.orderType,
    paymentStatus: order.paymentStatus,
    acceptedAt: order.acceptedAt,
    preparingAt: order.preparingAt,
    readyAt: order.readyAt,
    completedAt: order.completedAt,
    pickedUpAt: order.pickedUpAt,
    deliveredAt: order.deliveredAt,
    servedAt: order.servedAt,
    rejectedAt: order.rejectedAt,
    cancelledAt: order.cancelledAt,
  });
};

const emitNewOrder = (order) => {
  if (!io) return;
  io.to('admin').emit('new_order', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    orderType: order.orderType,
    totalAmount: order.totalAmount,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
  });
};

const emitNotification = (notification) => {
  if (!io || !notification) return;
  io.to(`user_${notification.userId}`).emit('notification_created', {
    notificationId: notification._id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    orderId: notification.orderId,
    createdAt: notification.createdAt,
  });
};

const emitGroupUpdate = (group) => {
  if (!io || !group) return;
  const activeMembers = (group.members || []).filter((member) => member.status === 'JOINED');
  const { allocatePaise, acceptancesComplete } = require('../utils/groupItemAllocation');
  const payload = {
    groupId: String(group._id),
    groupCode: group.groupCode,
    status: group.status,
    leaderId: String(group.leaderId?._id || group.leaderId),
    maxMembers: group.maxMembers,
    activeMemberCount: activeMembers.length,
    members: activeMembers.map((member) => ({
      userId: String(member.userId?._id || member.userId),
      name: member.name,
      joinedAt: member.joinedAt,
    })),
    orderType: group.orderType,
    expiresAt: group.expiresAt,
    orderId: String(group.orderId?._id || group.orderId || ''),
    checkoutMode: group.checkoutMode || null,
    paymentMethod: group.paymentMethod || null,
    paymentVerifiedAt: group.paymentVerifiedAt || null,
    memberShares: (group.memberShares || []).map((share) => ({ userId: String(share.userId?._id || share.userId), amountPaise: share.amountPaise })),
    contributions: (group.contributions || []).map((contribution) => ({
      contributionId: String(contribution._id),
      userId: String(contribution.userId?._id || contribution.userId),
      amountPaise: contribution.amountPaise,
      method: contribution.method,
      status: contribution.status,
    })),
    totalContributionsPaise: (group.contributions || []).reduce((sum, contribution) => sum + (Number(contribution.amountPaise) || 0), 0),
    verifiedContributionsPaise: (group.contributions || []).reduce((sum, contribution) => sum + (contribution.status === 'SUCCESS' ? Number(contribution.amountPaise) || 0 : 0), 0),
    items: (group.items || []).map((item) => {
      let allocations = [];
      try { allocations = allocatePaise(item.itemTotalPaise, item.allocations || []); } catch (_) { /* Older/invalid drafts remain visible for refresh and correction. */ }
      return {
        itemId: String(item._id),
        productId: String(item.productId),
        selectedBy: String(item.selectedBy?._id || item.selectedBy),
        name: item.name,
        priceAtPurchase: item.priceAtPurchase,
        quantity: item.quantity,
        customizations: (item.customizations || []).map((customization) => ({ name: customization.name, price: customization.price })),
        itemTotalPaise: item.itemTotalPaise,
        shareMode: item.shareMode,
        revision: item.revision,
        sharesAccepted: acceptancesComplete(item),
        allocations: allocations.map((allocation) => ({
          userId: allocation.userId,
          percentageBps: allocation.percentageBps,
          amountPaise: allocation.amountPaise,
          accepted: (item.allocations || []).some((source) => String(source.userId?._id || source.userId) === allocation.userId
            && source.acceptedRevision === item.revision && Boolean(source.acceptedAt)),
        })),
      };
    }),
  };
  // Group contents are delivered only to current members. Removed members
  // must not receive later cart, participant, or payment updates.
  const recipients = new Set((group.members || [])
    .filter((member) => member.status === 'JOINED')
    .map((member) => String(member.userId?._id || member.userId)));
  for (const userId of recipients) {
    if (!userId || userId === 'undefined' || userId === 'null') continue;
    io.to(`user_${userId}`).emit('group_updated', payload);
  }
};

module.exports = { init, getIO, disconnectUserSockets, emitOrderUpdate, emitNewOrder, emitNotification, emitGroupUpdate };
