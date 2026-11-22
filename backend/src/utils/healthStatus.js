const readinessStatus = (databaseReadyState) => {
  const connected = databaseReadyState === 1;
  return {
    httpStatus: connected ? 200 : 503,
    body: {
      status: connected ? 'ok' : 'degraded',
      database: connected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    },
  };
};

const livenessStatus = () => ({
  httpStatus: 200,
  body: {
    status: 'ok',
    service: 'live',
    timestamp: new Date().toISOString(),
  },
});

module.exports = { readinessStatus, livenessStatus };
