const loyaltyPolicyReady = policy => Boolean(policy?.enabled
  && Number.isInteger(policy.earnEveryRupees) && policy.earnEveryRupees > 0
  && Number.isInteger(policy.pointsPerStep) && policy.pointsPerStep > 0
  && Number.isInteger(policy.paisePerPoint) && policy.paisePerPoint > 0
  && Number.isInteger(policy.minimumRedemptionPoints) && policy.minimumRedemptionPoints > 0
  && Number.isInteger(policy.maxRedemptionPercent) && policy.maxRedemptionPercent > 0);

const loyaltyRedemptionReady = policy => Boolean(Number.isInteger(policy?.paisePerPoint) && policy.paisePerPoint > 0
  && Number.isInteger(policy.minimumRedemptionPoints) && policy.minimumRedemptionPoints > 0
  && Number.isInteger(policy.maxRedemptionPercent) && policy.maxRedemptionPercent > 0);

const quoteLoyaltyRedemption = ({ policy, points, balance, eligibleSubtotalPaise }) => {
  if (!Number.isInteger(points) || points < 0 || points > 1000000) throw Object.assign(new Error('Reward points must be a whole number from 0 to 1,000,000.'), { statusCode: 400 });
  if (!Number.isSafeInteger(eligibleSubtotalPaise) || eligibleSubtotalPaise < 0) throw Object.assign(new Error('The eligible order subtotal is invalid.'), { statusCode: 400 });
  if (points === 0) return { points: 0, discountPaise: 0, maximumPoints: 0 };
  if (!loyaltyRedemptionReady(policy)) throw Object.assign(new Error('Outlet loyalty redemption is not configured yet.'), { statusCode: 409 });
  if (points > balance) throw Object.assign(new Error('You do not have enough available reward points.'), { statusCode: 409 });
  if (points < policy.minimumRedemptionPoints) throw Object.assign(new Error(`Redeem at least ${policy.minimumRedemptionPoints} points.`), { statusCode: 400 });
  const maxDiscountPaise = Math.floor(eligibleSubtotalPaise * policy.maxRedemptionPercent / 100);
  const maximumPoints = Math.min(balance, Math.floor(maxDiscountPaise / policy.paisePerPoint));
  if (points > maximumPoints) throw Object.assign(new Error(`You can use up to ${maximumPoints} points on this order.`), { statusCode: 400 });
  const discountPaise = points * policy.paisePerPoint;
  if (!Number.isSafeInteger(discountPaise) || discountPaise <= 0 || discountPaise >= eligibleSubtotalPaise) throw Object.assign(new Error('Reward points cannot reduce this order below a payable subtotal.'), { statusCode: 400 });
  return { points, discountPaise, maximumPoints };
};

const earnedPointsForOrder = ({ policy, eligibleSpendPaise }) => {
  if (policy?.enabled === false || !Number.isInteger(policy?.earnEveryRupees) || policy.earnEveryRupees <= 0
    || !Number.isInteger(policy?.pointsPerStep) || policy.pointsPerStep <= 0
    || !Number.isSafeInteger(eligibleSpendPaise) || eligibleSpendPaise <= 0) return 0;
  const blocks = Math.floor(eligibleSpendPaise / (policy.earnEveryRupees * 100));
  return Math.min(1000000, blocks * policy.pointsPerStep);
};

const loyaltyTierForLifetimePoints = (tiers, points) => (Array.isArray(tiers) ? tiers : [])
  .filter(tier => Number.isInteger(tier.minimumLifetimePoints) && tier.minimumLifetimePoints <= points)
  .sort((a, b) => b.minimumLifetimePoints - a.minimumLifetimePoints)[0] || null;

const validateLoyaltyPolicy = raw => {
  const fail = message => { throw Object.assign(new Error(message), { statusCode: 400 }); };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('Loyalty settings must be an object.');
  const allowed = ['enabled', 'earnEveryRupees', 'pointsPerStep', 'paisePerPoint', 'minimumRedemptionPoints', 'maxRedemptionPercent', 'tiers'];
  if (Object.keys(raw).some(key => !allowed.includes(key))) fail('Loyalty settings contain unsupported fields.');
  if (typeof raw.enabled !== 'boolean') fail('Loyalty enabled must be a boolean.');
  const numeric = ['earnEveryRupees', 'pointsPerStep', 'paisePerPoint', 'minimumRedemptionPoints', 'maxRedemptionPercent'];
  const bounds = { earnEveryRupees: [0, 100000], pointsPerStep: [0, 100000], paisePerPoint: [0, 100000], minimumRedemptionPoints: [0, 1000000], maxRedemptionPercent: [0, 50] };
  for (const key of numeric) {
    if (!Number.isInteger(raw[key]) || raw[key] < bounds[key][0] || raw[key] > bounds[key][1]) fail(`${key} must be a whole number within its allowed range.`);
  }
  if (!Array.isArray(raw.tiers) || raw.tiers.length > 5) fail('Configure up to five loyalty tiers.');
  const tiers = raw.tiers.map(tier => {
    if (!tier || typeof tier.name !== 'string' || !tier.name.trim() || tier.name.trim().length > 24
      || !Number.isInteger(tier.minimumLifetimePoints) || tier.minimumLifetimePoints < 0 || tier.minimumLifetimePoints > 100000000) fail('Each tier needs a short name and a whole-number lifetime point threshold.');
    return { name: tier.name.trim(), minimumLifetimePoints: tier.minimumLifetimePoints };
  }).sort((a, b) => a.minimumLifetimePoints - b.minimumLifetimePoints);
  if (new Set(tiers.map(tier => tier.name.toLowerCase())).size !== tiers.length
    || new Set(tiers.map(tier => tier.minimumLifetimePoints)).size !== tiers.length) fail('Loyalty tier names and thresholds must be unique.');
  if (raw.enabled && (numeric.some(key => raw[key] <= 0) || tiers.length < 1 || tiers[0].minimumLifetimePoints !== 0)) {
    fail('Before enabling rewards, set earning, redemption and at least one tier starting at 0 lifetime points.');
  }
  return { ...Object.fromEntries(numeric.map(key => [key, raw[key]])), enabled: raw.enabled, tiers };
};

module.exports = { loyaltyPolicyReady, loyaltyRedemptionReady, quoteLoyaltyRedemption, earnedPointsForOrder, loyaltyTierForLifetimePoints, validateLoyaltyPolicy };
