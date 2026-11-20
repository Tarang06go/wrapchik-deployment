const ACTIVE_ORDER_STATES = new Set(['PLACED', 'ACCEPTED', 'PREPARING']);

export const orderAgeMinutes = (createdAt, now = Date.now()) => {
  const createdMs = new Date(createdAt).getTime();
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(createdMs) || !Number.isFinite(nowMs)) return null;
  return Math.max(0, Math.floor((nowMs - createdMs) / 60000));
};

export const isOrderOverdue = (order, thresholdMinutes, now = Date.now()) => {
  const threshold = Number(thresholdMinutes);
  if (!ACTIVE_ORDER_STATES.has(order?.orderStatus) || !Number.isInteger(threshold) || threshold < 1 || threshold > 240) return false;
  const age = orderAgeMinutes(order.createdAt, now);
  return age !== null && age >= threshold;
};
