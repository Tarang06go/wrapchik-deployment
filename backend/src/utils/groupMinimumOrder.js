const minimumGroupSubtotalPaise = settings => Math.round(Math.max(0, Number(settings?.groupMinimumOrderValue || 0) * 100));
const meetsGroupMinimum = (settings, subtotalPaise) => Number.isSafeInteger(subtotalPaise) && subtotalPaise >= minimumGroupSubtotalPaise(settings);

module.exports = { minimumGroupSubtotalPaise, meetsGroupMinimum };
