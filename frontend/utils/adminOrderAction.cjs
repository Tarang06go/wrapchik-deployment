'use strict';

const ONLINE_METHODS = new Set(['RAZORPAY', 'CASHFREE', 'UPI_QR']);
const isPaid = order => order?.paymentStatus === 'SUCCESS';

const getAdminOrderAction = order => {
  if (!order || !order.orderStatus) return null;
  const { orderStatus, orderType = 'TAKEAWAY', paymentMethod = 'COUNTER' } = order;
  if (orderStatus === 'PLACED') {
    if ((ONLINE_METHODS.has(paymentMethod) || order.groupOrderId) && !isPaid(order)) return null;
    return { status: 'ACCEPTED', title: 'Accept' };
  }
  if (orderStatus === 'ACCEPTED') return { status: 'PREPARING', title: 'Start Preparing' };
  if (orderStatus === 'PREPARING') return orderType === 'DINE_IN'
    ? { status: 'SERVED', title: 'Mark as Served' }
    : { status: 'READY', title: 'Mark Ready for Pickup' };
  if (orderStatus === 'READY') {
    if (!isPaid(order)) return null;
    return orderType === 'DELIVERY'
      ? { status: 'PICKED_UP', title: 'Mark Picked Up' }
      : { status: 'COMPLETED', title: 'Mark Completed' };
  }
  if (orderStatus === 'PICKED_UP' && orderType === 'DELIVERY' && isPaid(order)) return { status: 'DELIVERED', title: 'Mark Delivered' };
  if (orderStatus === 'SERVED' && orderType === 'DINE_IN' && isPaid(order)) return { status: 'COMPLETED', title: 'Mark Completed' };
  return null;
};

module.exports = { getAdminOrderAction };
