'use strict';

const NUMBER_PATTERN = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/;

const validateNumericText = (raw, {
  label = 'Value', min = 0, max = Number.MAX_SAFE_INTEGER,
  integer = false, required = true, maxDecimalPlaces = 2,
} = {}) => {
  const text = raw == null ? '' : String(raw).trim();
  if (!text) return required
    ? { value: null, error: `${label} is required.` }
    : { value: null, error: null };
  if (!NUMBER_PATTERN.test(text)) return { value: null, error: `Enter a valid ${integer ? 'whole number' : 'number'} for ${label.toLowerCase()}.` };
  const value = Number(text);
  if (!Number.isFinite(value)) return { value: null, error: `${label} must be a finite number.` };
  if (integer && !Number.isInteger(value)) return { value: null, error: `${label} must be a whole number.` };
  if (!integer && (text.split('.')[1] || '').length > maxDecimalPlaces) return { value: null, error: `${label} can have at most ${maxDecimalPlaces} decimal places.` };
  if (value < min) return { value: null, error: `${label} must be at least ${min}.` };
  if (value > max) return { value: null, error: `${label} must be no more than ${max}.` };
  return { value, error: null };
};

const validateLoyaltyDraft = draft => {
  const errors = {};
  const enabled = draft?.enabled === true;
  const rules = {
    earnEveryRupees: ['Eligible spend block (₹)', 0, 100000],
    pointsPerStep: ['Points per spend block', 0, 100000],
    paisePerPoint: ['Value per point (paise)', 0, 100000],
    minimumRedemptionPoints: ['Minimum redemption points', 0, 1000000],
    maxRedemptionPercent: ['Maximum redemption percent', 0, 50],
  };
  const policy = { enabled, tiers: [] };

  for (const [key, [label, offMin, max]] of Object.entries(rules)) {
    const min = enabled ? 1 : offMin;
    const parsed = validateNumericText(draft?.[key], { label, min, max, integer: true, required: enabled });
    if (parsed.error) errors[key] = parsed.error;
    policy[key] = parsed.value == null ? 0 : parsed.value;
  }

  const tiers = Array.isArray(draft?.tiers) ? draft.tiers : [];
  if (tiers.length > 5) errors.tiers = 'Configure no more than five reward tiers.';
  policy.tiers = tiers.slice(0, 5).map((tier, index) => {
    const name = typeof tier?.name === 'string' ? tier.name.trim() : '';
    if (!name) errors[`tier.${index}.name`] = `Tier ${index + 1} needs a name.`;
    else if (name.length > 24) errors[`tier.${index}.name`] = `Tier ${index + 1} name must be 24 characters or fewer.`;
    const parsed = validateNumericText(tier?.minimumLifetimePoints, {
      label: `Tier ${index + 1} starting points`, min: 0, max: 100000000, integer: true,
    });
    if (parsed.error) errors[`tier.${index}.minimumLifetimePoints`] = parsed.error;
    return { name, minimumLifetimePoints: parsed.value };
  });

  const namedTiers = policy.tiers.filter(tier => tier.name);
  if (new Set(namedTiers.map(tier => tier.name.toLowerCase())).size !== namedTiers.length) {
    policy.tiers.forEach((tier, index) => {
      if (tier.name && namedTiers.filter(row => row.name.toLowerCase() === tier.name.toLowerCase()).length > 1) {
        errors[`tier.${index}.name`] = 'Tier names must be unique.';
      }
    });
  }
  const thresholds = policy.tiers.map(tier => tier.minimumLifetimePoints).filter(Number.isInteger);
  if (new Set(thresholds).size !== thresholds.length) {
    policy.tiers.forEach((tier, index) => {
      if (Number.isInteger(tier.minimumLifetimePoints) && thresholds.filter(value => value === tier.minimumLifetimePoints).length > 1) {
        errors[`tier.${index}.minimumLifetimePoints`] = 'Tier starting points must be unique.';
      }
    });
  }
  if (enabled && tiers.length === 0) errors.tiers = 'Add a first tier that starts at 0 points before enabling rewards.';
  else if (enabled && policy.tiers[0]?.minimumLifetimePoints !== 0) errors['tier.0.minimumLifetimePoints'] = 'The first tier must start at 0 points before rewards can be enabled.';

  return { errors, policy: Object.keys(errors).length === 0 ? policy : null };
};

module.exports = { validateNumericText, validateLoyaltyDraft };
