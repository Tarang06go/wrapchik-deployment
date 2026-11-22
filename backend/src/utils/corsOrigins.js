function parseCorsOrigins(rawOrigins, nodeEnv) {
  const origins = typeof rawOrigins === 'string'
    ? rawOrigins.split(',').map(origin => origin.trim()).filter(Boolean)
    : [];

  if (nodeEnv === 'production') {
    if (!origins.length) throw new Error('CORS_ORIGIN must contain comma-separated approved origins in production.');
    for (const origin of origins) {
      let parsed;
      try { parsed = new URL(origin); } catch { throw new Error('Production CORS_ORIGIN entries must be exact HTTPS origins.'); }
      if (parsed.protocol !== 'https:' || parsed.origin !== origin || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
        throw new Error('Production CORS_ORIGIN entries must be exact HTTPS origins without paths or credentials.');
      }
    }
  }
  return origins.length ? origins : null;
}

module.exports = { parseCorsOrigins };
