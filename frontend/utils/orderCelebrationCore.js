const DECLINED_ORDER_STATUSES = new Set(['CANCELLED', 'REJECTED']);

export const shouldCelebrateOrderPlacement = (requested, orderOrStatus) => {
  const order = orderOrStatus && typeof orderOrStatus === 'object' ? orderOrStatus : null;
  const orderStatus = order?.orderStatus;
  const paymentAllowed = order?.paymentMethod === 'COUNTER' || order?.paymentStatus === 'SUCCESS';
  return Boolean(requested)
    && typeof orderStatus === 'string'
    && orderStatus.length > 0
    && !DECLINED_ORDER_STATUSES.has(orderStatus)
    && paymentAllowed;
};
