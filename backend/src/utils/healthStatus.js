const healthStatus = (databaseReadyState) => {
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

module.exports = healthStatus;
