const PLACEHOLDER = /(REPLACE|YOUR|PLACEHOLDER|CHANGE[-_ ]?ME|\bTODO\b|\bSAMPLE\b|\bDUMMY\b|example\.[a-z]+|\.invalid(?:\/|$)|<[^>]*>)/i;
const LOOPBACK_HOSTS = new Set(['localhost', 'localhost.localdomain', '::1', '0.0.0.0', '10.0.2.2']);

const args = process.argv.slice(2);
const profileArg = args.indexOf('--profile');
const profile = (profileArg >= 0 ? args[profileArg + 1] : process.env.EAS_BUILD_PROFILE || '').trim();

if (!['preview', 'production'].includes(profile)) {
  console.log(`API URL build validation skipped for profile ${profile || '(unspecified/development)'}.`);
  process.exit(0);
}

const value = String(process.env.EXPO_PUBLIC_API_URL || '').trim();
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
if (LOOPBACK_HOSTS.has(host) || /^127\./.test(host) || ['undefined', 'null', 'test', 'example', 'invalid'].includes(host) || /\.(test|example|invalid|localhost|local)$/.test(host)) {
  fail('loopback/emulator hosts cannot be reached by customer devices.');
}

// Preview APKs are release Android builds too: the app requires HTTPS and Android blocks cleartext HTTP.
if (url.protocol !== 'https:') {
  fail(`${profile} builds require HTTPS; local HTTP is supported only by development builds.`);
}

console.log(`EXPO_PUBLIC_API_URL is valid for EAS ${profile}.`);
