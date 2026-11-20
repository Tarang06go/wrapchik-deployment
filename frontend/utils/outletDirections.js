const DEFAULT_OUTLET_QUERY = 'Wrapchik SAC Counter, Student Activity Center, TIET Patiala';

export const outletDirectionsUrl = (platform, configuredLocation) => {
  const location = typeof configuredLocation === 'string' && configuredLocation.trim()
    ? configuredLocation.trim()
    : DEFAULT_OUTLET_QUERY;
  const query = encodeURIComponent(location);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
};
