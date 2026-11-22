export const getRecommendedPickupSlot = slots => {
  if (!Array.isArray(slots)) return null;
  return slots
    .map((slot, index) => ({ slot, index, startsAt: new Date(slot?.startsAt).getTime() }))
    .filter(({ slot, startsAt }) => Number.isFinite(startsAt) && Number(slot?.availableCount) > 0)
    .sort((a, b) => a.startsAt - b.startsAt || a.index - b.index)[0]?.slot || null;
};
