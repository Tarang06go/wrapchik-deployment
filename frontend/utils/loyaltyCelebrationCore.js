const CREDITED_ORDER_STATES = new Set(['COMPLETED', 'PICKED_UP', 'DELIVERED', 'SERVED']);

export const newlyCreditedLoyaltyPoints = (previousOrder, nextOrder) => {
  const previous = Number(previousOrder?.loyaltyPointsEarned || 0);
  const credited = Number(nextOrder?.loyaltyPointsEarned);
  if (!previousOrder || previous !== 0 || !Number.isInteger(credited) || credited <= 0) return 0;
  if (nextOrder?.paymentStatus !== 'SUCCESS' || !CREDITED_ORDER_STATES.has(nextOrder?.orderStatus) || nextOrder?.groupOrderId) return 0;
  return credited;
};
