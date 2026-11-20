// Development check: every in-app navigation target must map to a file under app/.
const fs = require('fs');
const path = require('path');

const collect = (dir, filter, out) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, filter, out);
    else if (filter(entry.name)) out.push(full);
  }
  return out;
};

const toPosix = (value) => value.split(path.sep).join('/');

const routes = new Set();
for (const file of collect('app', (name) => /\.jsx?$/.test(name), [])) {
  let route = toPosix(file).replace(/^app/, '').replace(/\.jsx?$/, '');
  if (route.endsWith('/index')) route = route.slice(0, -'/index'.length);
  routes.add(route || '/');
}

const targets = new Map();
for (const file of [...collect('app', (name) => /\.jsx?$/.test(name), []), ...collect('components', (name) => /\.jsx?$/.test(name), []), ...collect('context', (name) => /\.jsx?$/.test(name), []), ...collect('services', (name) => /\.jsx?$/.test(name), [])]) {
  const source = fs.readFileSync(file, 'utf8');
  const patterns = [
    /(?:router\.(?:push|replace|navigate)|href=)\s*\(?\{?\s*(?:pathname\s*:\s*)?['"`]([^'"`]+)['"`]/g,
    /\broute\s*:\s*['"`]([^'"`]+)['"`]/g,
  ];
  for (const pattern of patterns) for (const match of source.matchAll(pattern)) {
    const target = match[1].replace(/\$\{[^}]+\}/g, '[id]');
    if (!target.startsWith('/')) continue;
    const clean = target.split('?')[0].replace(/\/$/, '') || '/';
    if (!targets.has(clean)) targets.set(clean, []);
    targets.get(clean).push(file);
  }
}

let missing = 0;
for (const [target, sources] of targets) {
  const base = target.replace(/\[[^\]]+\]/g, '[id]');
  if (!routes.has(base) && !routes.has(`${base}/index`)) {
    missing += 1;
    console.log('MISSING ROUTE', target, '<-', sources.slice(0, 2).join(', '));
  }
}
console.log(`checked ${targets.size} navigation targets; missing ${missing}`);
