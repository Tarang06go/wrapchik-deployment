export const getConfiguredPickupPoint = settings => (
  typeof settings?.pickupLocation === 'string' && settings.pickupLocation.trim()
    ? settings.pickupLocation.trim()
    : ''
);
