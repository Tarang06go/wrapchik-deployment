const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function assertProductionDatabaseUri(mongoUri, nodeEnv) {
  if (nodeEnv !== 'production') return;
  if (typeof mongoUri !== 'string' || !mongoUri.trim()) throw new Error('MONGO_URI must point to the production database when NODE_ENV=production.');
  let parsed;
  try { parsed = new URL(mongoUri); } catch { throw new Error('MONGO_URI must be a valid MongoDB URL in production.'); }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, '').split('/')[0] || '');
  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) || !parsed.hostname || !databaseName || LOCAL_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error('Production MONGO_URI must name a non-local MongoDB database.');
  }
}

module.exports = { assertProductionDatabaseUri };
