const { userKey, allocatePaise, equalAllocations } = require('./groupItemAllocation');

const allocateByWeightsPaise = (totalPaise, rows) => {
  if (!Number.isSafeInteger(totalPaise) || totalPaise < 0 || !Array.isArray(rows) || rows.length === 0) {
    throw new Error('A non-negative paise total and at least one member are required.');
  }
  const normalized = rows.map((row) => ({ userId: userKey(row.userId), weight: BigInt(row.weight) }));
  if (normalized.some((row) => !row.userId || row.weight < 0n) || new Set(normalized.map((row) => row.userId)).size !== normalized.length) {
    throw new Error('Group member weights must be unique and non-negative.');
  }
  let totalWeight = normalized.reduce((sum, row) => sum + row.weight, 0n);
  let weightedRows = normalized;
  if (totalWeight === 0n) {
    weightedRows = normalized.map((row) => ({ ...row, weight: 1n }));
    totalWeight = BigInt(weightedRows.length);
  }
  const amount = BigInt(totalPaise);
  const results = weightedRows.map((row) => {
    const numerator = amount * row.weight;
    return { userId: row.userId, amountPaise: Number(numerator / totalWeight), remainder: numerator % totalWeight };
  });
  let remaining = totalPaise - results.reduce((sum, row) => sum + row.amountPaise, 0);
  const stableRemainders = [...results].sort((a, b) => (a.remainder === b.remainder ? a.userId.localeCompare(b.userId) : a.remainder > b.remainder ? -1 : 1));
  for (let i = 0; remaining > 0; i += 1, remaining -= 1) stableRemainders[i % stableRemainders.length].amountPaise += 1;
  return results.map(({ userId, amountPaise }) => ({ userId, amountPaise }));
};

const prepareGroupContributions = ({ members, items, checkoutMode, hostId, discountPaise = 0, taxPaise = 0, deliveryFeePaise = 0 }) => {
  if (!['SPLIT', 'HOST_PAYS'].includes(checkoutMode)) throw new Error('Choose a supported group checkout mode.');
  if (!Array.isArray(members) || members.length < 2) throw new Error('At least two active group members are required.');
  if (!Array.isArray(items) || items.length === 0) throw new Error('The group cart is empty.');
  for (const amount of [discountPaise, taxPaise, deliveryFeePaise]) {
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Group fees and discounts must be valid whole paise amounts.');
  }
  const userIds = members.map((member) => userKey(member.userId));
  if (userIds.some((id) => !id) || new Set(userIds).size !== userIds.length) throw new Error('The active group membership is invalid.');
  const userSet = new Set(userIds);
  const itemTotals = new Map(userIds.map((id) => [id, 0]));
  let subtotalPaise = 0;
  for (const item of items) {
    const itemTotalPaise = Number(item.itemTotalPaise);
    if (!Number.isSafeInteger(itemTotalPaise) || itemTotalPaise < 0) throw new Error('A group item has an invalid saved price.');
    const allocations = item.allocations || [];
    if (allocations.length === 0 || allocations.some((row) => !userSet.has(userKey(row.userId)))) throw new Error('Every item share must belong to an active group member.');
    const unique = new Set(allocations.map((row) => userKey(row.userId)));
    if (unique.size !== allocations.length || allocations.some((row) => !Number.isSafeInteger(Number(row.amountPaise)) || Number(row.amountPaise) < 0)) throw new Error('A group item has invalid member allocations.');
    const allocationTotal = allocations.reduce((sum, row) => sum + Number(row.amountPaise), 0);
    if (allocationTotal !== itemTotalPaise) throw new Error('Item shares must add up to the full item price.');
    subtotalPaise += itemTotalPaise;
    if (!Number.isSafeInteger(subtotalPaise)) throw new Error('The group subtotal is outside the supported amount range.');
    allocations.forEach((row) => itemTotals.set(userKey(row.userId), itemTotals.get(userKey(row.userId)) + Number(row.amountPaise)));
  }
  if (discountPaise > subtotalPaise) throw new Error('The group discount cannot exceed the item subtotal.');

  const discountShares = allocateByWeightsPaise(discountPaise, userIds.map((userId) => ({ userId, weight: itemTotals.get(userId) })));
  const discountByUser = new Map(discountShares.map((row) => [row.userId, row.amountPaise]));
  const netItems = userIds.map((userId) => ({ userId, amountPaise: itemTotals.get(userId) - (discountByUser.get(userId) || 0) }));
  const taxShares = allocateByWeightsPaise(taxPaise, netItems.map((row) => ({ userId: row.userId, weight: row.amountPaise })));
  const feeShares = allocatePaise(deliveryFeePaise, equalAllocations(userIds));
  const taxByUser = new Map(taxShares.map((row) => [row.userId, row.amountPaise]));
  const feeByUser = new Map(feeShares.map((row) => [row.userId, row.amountPaise]));
  const memberShares = userIds.map((userId) => ({
    userId,
    amountPaise: (itemTotals.get(userId) - (discountByUser.get(userId) || 0)) + (taxByUser.get(userId) || 0) + (feeByUser.get(userId) || 0),
  }));
  const totalPaise = subtotalPaise - discountPaise + taxPaise + deliveryFeePaise;
  if (!Number.isSafeInteger(totalPaise) || totalPaise <= 0 || memberShares.reduce((sum, row) => sum + row.amountPaise, 0) !== totalPaise) {
    throw new Error('Member shares do not match the authoritative group order total.');
  }

  if (checkoutMode === 'HOST_PAYS') {
    const hostKey = userKey(hostId);
    if (!userSet.has(hostKey)) throw new Error('The paying host must be an active group member.');
    return { subtotalPaise, totalPaise, memberShares, contributions: [{ userId: hostKey, amountPaise: totalPaise }] };
  }
  return { subtotalPaise, totalPaise, memberShares, contributions: memberShares.filter((row) => row.amountPaise > 0) };
};

module.exports = { allocateByWeightsPaise, prepareGroupContributions };
