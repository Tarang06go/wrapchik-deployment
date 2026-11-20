const BASIS_POINTS = 10_000;

const userKey = (value) => String(value?._id || value || '');

const allocatePaise = (totalPaise, allocations) => {
  if (!Number.isSafeInteger(totalPaise) || totalPaise < 0 || !Array.isArray(allocations) || allocations.length === 0) {
    throw new Error('A valid item total and at least one allocation are required.');
  }

  const normalized = allocations.map((allocation) => ({
    userId: userKey(allocation.userId),
    percentageBps: Number(allocation.percentageBps),
  }));
  if (normalized.some((allocation) => !allocation.userId || !Number.isInteger(allocation.percentageBps) || allocation.percentageBps <= 0)) {
    throw new Error('Each participant must receive a positive whole-number share.');
  }
  if (new Set(normalized.map((allocation) => allocation.userId)).size !== normalized.length) {
    throw new Error('A participant can only be listed once.');
  }
  if (normalized.reduce((sum, allocation) => sum + allocation.percentageBps, 0) !== BASIS_POINTS) {
    throw new Error('Contribution shares must total exactly 100%.');
  }

  const total = BigInt(totalPaise);
  const rows = normalized.map((allocation) => {
    const numerator = total * BigInt(allocation.percentageBps);
    return {
      ...allocation,
      amountPaise: Number(numerator / BigInt(BASIS_POINTS)),
      remainder: numerator % BigInt(BASIS_POINTS),
    };
  });
  let remainingPaise = totalPaise - rows.reduce((sum, row) => sum + row.amountPaise, 0);
  const stableRemainderOrder = [...rows].sort((a, b) => a.userId.localeCompare(b.userId));
  for (let index = 0; remainingPaise > 0; index += 1, remainingPaise -= 1) {
    stableRemainderOrder[index % stableRemainderOrder.length].amountPaise += 1;
  }

  return rows.map(({ userId, percentageBps, amountPaise }) => ({ userId, percentageBps, amountPaise }));
};

const equalAllocations = (userIds) => {
  const uniqueIds = [...new Set((userIds || []).map(userKey))].sort((a, b) => a.localeCompare(b));
  if (uniqueIds.length < 2) throw new Error('A shared dish requires at least two participants.');
  const base = Math.floor(BASIS_POINTS / uniqueIds.length);
  let remainder = BASIS_POINTS - base * uniqueIds.length;
  return uniqueIds.map((userId) => ({ userId, percentageBps: base + (remainder-- > 0 ? 1 : 0) }));
};

const acceptancesComplete = (item) => (item.allocations || []).length > 0
  && item.allocations.every((allocation) => allocation.acceptedRevision === item.revision && allocation.acceptedAt);

module.exports = { BASIS_POINTS, userKey, allocatePaise, equalAllocations, acceptancesComplete };
