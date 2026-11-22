const LEGACY_PICKUP_LOCATION = 'Wrapchik Counter, SAC Ground Floor';

const resolvePickupLocation = configuredLocation => {
  const configured = typeof configuredLocation === 'string' ? configuredLocation.trim() : '';
  return configured || LEGACY_PICKUP_LOCATION;
};

module.exports = { LEGACY_PICKUP_LOCATION, resolvePickupLocation };
