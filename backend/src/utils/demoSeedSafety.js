const DEMO_DATABASE_NAME = 'wrapchik_demo';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function assertDemoSeedTarget(rawUri, nodeEnv) {
  if (nodeEnv === 'production') throw new Error('Demo seeding is disabled in production.');
  if (typeof rawUri !== 'string' || !rawUri.trim()) throw new Error('Set MONGO_DEMO_URI to a local wrapchik_demo database.');

  let uri;
  try { uri = new URL(rawUri); } catch { throw new Error('MONGO_DEMO_URI is not a valid MongoDB URL.'); }
  const databaseName = decodeURIComponent(uri.pathname.replace(/^\//, '').split('/')[0] || '');
  if (uri.protocol !== 'mongodb:' || !LOCAL_HOSTS.has(uri.hostname.toLowerCase()) || databaseName !== DEMO_DATABASE_NAME) {
    throw new Error(`Demo seeding is restricted to localhost/${DEMO_DATABASE_NAME}; no data was changed.`);
  }
  return { host: uri.hostname, databaseName };
}

function assertDemoApplyConfirmation(apply, confirmed) {
  if (apply && !confirmed) throw new Error('Pass --confirm-demo-db with --apply to confirm the isolated demo database.');
}

module.exports = { DEMO_DATABASE_NAME, assertDemoSeedTarget, assertDemoApplyConfirmation };
