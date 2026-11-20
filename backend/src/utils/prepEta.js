const Order = require('../models/Order');

const CACHE_TTL_MS = 5 * 60 * 1000;
const MIN_SAMPLE_COUNT = 5;
const cache = new Map();

const getIndiaHour = date => Number(new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23',
}).format(date));

const estimatePrepMinutes = async ({ order, fallbackMinutes = 15, now = new Date(), aggregate = null }) => {
  const fallback = Math.min(240, Math.max(5, Math.round(Number(fallbackMinutes) || 15)));
  if (!order?.createdAt || !order?.orderType) return { minutes: fallback, source: 'outlet_default', samples: 0 };
  const hour = getIndiaHour(new Date(order.createdAt));
  const cacheKey = `${order.orderType}:${hour}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now.getTime()) return { ...cached.value, source: 'rolling_hourly_average' };

  const startDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const pipeline = [
    { $match: { orderType: order.orderType, acceptedAt: { $ne: null }, readyAt: { $ne: null }, createdAt: { $gte: startDate, $lte: new Date(order.createdAt) } } },
    { $project: { hour: { $hour: { date: '$createdAt', timezone: 'Asia/Kolkata' } }, durationMs: { $subtract: ['$readyAt', '$acceptedAt'] } } },
    { $match: { hour, durationMs: { $gte: 60000, $lte: 10800000 } } },
    { $group: { _id: null, samples: { $sum: 1 }, averageMs: { $avg: '$durationMs' } } },
  ];
  const rows = aggregate ? await aggregate(pipeline) : await Order.aggregate(pipeline);
  const [result] = rows;
  if (!result || result.samples < MIN_SAMPLE_COUNT || !Number.isFinite(result.averageMs)) {
    return { minutes: fallback, source: 'outlet_default', samples: result?.samples || 0 };
  }
  const value = { minutes: Math.min(240, Math.max(5, Math.round(result.averageMs / 60000))), samples: result.samples };
  cache.set(cacheKey, { value, expiresAt: now.getTime() + CACHE_TTL_MS });
  return { ...value, source: 'rolling_hourly_average' };
};

const clearPrepEtaCache = () => cache.clear();

module.exports = { CACHE_TTL_MS, MIN_SAMPLE_COUNT, getIndiaHour, estimatePrepMinutes, clearPrepEtaCache };
