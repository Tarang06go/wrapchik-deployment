const DECLINED_ORDER_STATUSES = new Set(['CANCELLED', 'REJECTED']);

export const shouldCelebrateOrderPlacement = (requested, orderStatus) => (
  Boolean(requested)
  && typeof orderStatus === 'string'
  && orderStatus.length > 0
  && !DECLINED_ORDER_STATUSES.has(orderStatus)
);
