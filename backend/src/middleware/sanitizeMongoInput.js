const cleanValue = value => {
  if (Array.isArray(value)) return value.map(cleanValue);
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return value;
  const clean = {};
  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'prototype' || key === 'constructor') continue;
    clean[key] = cleanValue(child);
  }
  return clean;
};

const sanitizeMongoInput = (req, res, next) => {
  if (req.body && typeof req.body === 'object') req.body = cleanValue(req.body);
  const query = req.query;
  if (query && typeof query === 'object') {
    Object.defineProperty(req, 'query', { value: cleanValue(query), configurable: true, enumerable: true, writable: true });
  }
  next();
};

module.exports = { sanitizeMongoInput, cleanValue };
