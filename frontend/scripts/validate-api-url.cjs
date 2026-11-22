const PLACEHOLDER = /(REPLACE|YOUR|PLACEHOLDER|CHANGE[-_ ]?ME|\bTODO\b|\bSAMPLE\b|\bDUMMY\b|example\.[a-z]+|\.invalid(?:\/|$)|<[^>]*>)/i;
const LOOPBACK_HOSTS = new Set(['localhost', 'localhost.localdomain', '::1', '0.0.0.0', '10.0.2.2']);
const isPrivateNetworkHost = (host) => {
  if (host === '0.0.0.0' || /^(10\.|127\.|169\.254\.|192\.168\.)/.test(host) || /\.(?:local|localhost)$/.test(host)) return true;
  if (host.startsWith('::ffff:')) return isPrivateNetworkHost(host.slice('::ffff:'.length));
  const private172 = host.match(/^172\.(\d{1,3})\./);
  if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return true;
  return /^f[cd][0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host);
};

const args = process.argv.slice(2);
const profileArg = args.indexOf('--profile');
const profile = (profileArg >= 0 ? args[profileArg + 1] : process.env.EAS_BUILD_PROFILE || '').trim();
const envFileArg = args.indexOf('--env-file');
let configuredValue = process.env.EXPO_PUBLIC_API_URL;
if (!configuredValue && envFileArg >= 0 && args[envFileArg + 1]) {
  try {
    const envSource = require('node:fs').readFileSync(args[envFileArg + 1], 'utf8');
    const match = envSource.match(/^\s*EXPO_PUBLIC_API_URL\s*=\s*(.*?)\s*$/m);
    configuredValue = match?.[1]?.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted) || '';
  } catch (_) {
    console.error('Could not read the specified API environment file.');
    process.exit(1);
  }
}

if (!['preview', 'production'].includes(profile)) {
  console.log(`API URL build validation skipped for profile ${profile || '(unspecified/development)'}.`);
  process.exit(0);
}

const value = String(configuredValue || '').trim();
const fail = (reason) => {
  console.error(`[EAS ${profile}] Invalid EXPO_PUBLIC_API_URL: ${reason}`);
  console.error('Set EXPO_PUBLIC_API_URL to the real HTTPS backend URL in the matching EAS environment.');
  process.exit(1);
};

if (!value) fail('the variable is missing or empty.');
if (PLACEHOLDER.test(value)) fail('the value is a placeholder, not a deployed backend URL.');
if (/\s/.test(value) || !/^https?:\/\//i.test(value)) {
  fail('use an absolute URL beginning with https:// (without embedded whitespace).');
}

let url;
try {
  url = new URL(value);
} catch (_) {
  fail('it must be an absolute URL such as https://api.example.edu.');
}

if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
  fail('only absolute HTTP(S) URLs with a hostname are accepted.');
}
if (url.username || url.password || url.search || url.hash) {
  fail('credentials, query strings, and fragments are not allowed in the API base URL.');
}
if (!['', '/', '/api'].includes(url.pathname.replace(/\/+$/, ''))) {
  fail('use the backend origin, optionally followed by /api.');
}
const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
if (LOOPBACK_HOSTS.has(host) || isPrivateNetworkHost(host) || ['undefined', 'null', 'test', 'example', 'invalid'].includes(host) || /\.(test|example|invalid|localhost|local)$/.test(host)) {
  fail('loopback, emulator, and private LAN hosts cannot be reached from public customer networks.');
}

// Preview APKs are release Android builds too: the app requires HTTPS and Android blocks cleartext HTTP.
if (url.protocol !== 'https:') {
  fail(`${profile} builds require HTTPS; local HTTP is supported only by development builds.`);
}

console.log(`EXPO_PUBLIC_API_URL is valid for EAS ${profile}.`);
