const stable = value => {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
};

const same = (left, right) => JSON.stringify(stable(left)) === JSON.stringify(stable(right));

function planIndexMigration(existingIndexes, desiredIndexes) {
  const missing = [];
  for (const desired of desiredIndexes) {
    const sameKeys = existingIndexes.find(index => same(index.key, desired.keys));
    if (!sameKeys) {
      missing.push(desired);
      continue;
    }
    for (const option of ['unique', 'sparse', 'partialFilterExpression']) {
      const actual = sameKeys[option] ?? false;
      const expected = desired.options[option] ?? false;
      if (!same(actual, expected)) {
        throw new Error(`Existing index ${sameKeys.name || JSON.stringify(sameKeys.key)} has incompatible ${option} options.`);
      }
    }
  }
  return missing;
}

module.exports = { planIndexMigration };
