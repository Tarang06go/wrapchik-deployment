const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..', '..');
const frontend = path.join(root, 'frontend');
const args = process.argv.slice(2);
const baseArg = args.find((arg) => arg.startsWith('--base='));
const baseRef = baseArg?.slice('--base='.length) || '';

const isNativePackageName = (name) => /^(?:expo(?:-|$)|react-native(?:-|$)|@react-native(?:-|\/))/i.test(name);

const versionParts = (value) => {
  const match = String(value || '').trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  return match ? match.slice(1).map(Number) : null;
};

const versionWasBumped = (baseVersion, currentVersion) => {
  const base = versionParts(baseVersion);
  const current = versionParts(currentVersion);
  if (!base || !current) return false;
  for (let index = 0; index < 3; index += 1) {
    if (current[index] > base[index]) return true;
    if (current[index] < base[index]) return false;
  }
  return false;
};

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
};
const stable = (value) => JSON.stringify(canonicalize(value));
const readJson = (value) => JSON.parse(value);
const readBaseFile = (ref, relativePath) => execFileSync('git', ['show', `${ref}:${relativePath}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const readCurrentJson = (relativePath) => readJson(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const readBaseJson = (ref, relativePath) => readJson(readBaseFile(ref, relativePath));

const nativeDependencies = (manifest, lockfile) => {
  const dependencies = {};
  for (const [name, version] of Object.entries(manifest.dependencies || {})) {
    if (isNativePackageName(name)) dependencies[name] = version;
  }
  for (const [lockPath, entry] of Object.entries(lockfile.packages || {})) {
    const name = lockPath.match(/^node_modules\/(.+)$/)?.[1];
    if (name && isNativePackageName(name)) {
      dependencies[`lock:${name}`] = { version: entry.version, resolved: entry.resolved, integrity: entry.integrity };
    }
  }
  return dependencies;
};

const nativeConfig = (appJson, easJson) => ({
  expo: {
    plugins: appJson.expo?.plugins || [],
    android: appJson.expo?.android || {},
    ios: appJson.expo?.ios || {},
    updates: appJson.expo?.updates || {},
    runtimeVersion: appJson.expo?.runtimeVersion || null,
    scheme: appJson.expo?.scheme || null,
    orientation: appJson.expo?.orientation || null,
  },
  easNativeProfiles: Object.fromEntries(Object.entries(easJson.build || {}).map(([name, profile]) => [name, {
    developmentClient: profile.developmentClient || false,
    android: profile.android || {},
    ios: profile.ios || {},
  }])),
});

const gitPathList = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/).filter(Boolean).filter((file) => !/\/(?:build|\.gradle|\.idea)\//.test(file));
const baseNativePaths = (ref) => gitPathList(['ls-tree', '-r', '--name-only', ref, '--', 'frontend/android', 'frontend/ios']);
const workingNativePaths = () => [
  ...gitPathList(['ls-files', '--', 'frontend/android', 'frontend/ios']),
  ...gitPathList(['ls-files', '--others', '--exclude-standard', '--', 'frontend/android', 'frontend/ios']),
];
const baseNativeTree = (ref, paths) => Object.fromEntries(paths.map((relativePath) => {
  try {
    return [relativePath, execFileSync('git', ['show', `${ref}:${relativePath}`], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString('base64')];
  } catch (_) {
    return [relativePath, null];
  }
}));
const currentNativeTree = (paths) => Object.fromEntries(paths.map((relativePath) => {
  const absolutePath = path.join(root, relativePath);
  return [relativePath, fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath).toString('base64') : null];
}));

if (args.includes('--self-test')) {
  if (!isNativePackageName('expo-camera') || !isNativePackageName('react-native-screens') || !isNativePackageName('@react-native-async-storage/async-storage')) process.exit(1);
  if (isNativePackageName('axios') || !versionWasBumped('1.0.0', '1.0.1') || versionWasBumped('1.0.0', '1.0.0') || versionWasBumped('1.2.0', '1.1.9')) process.exit(1);
  console.log('Native runtime guard self-check passed.');
  process.exit(0);
}

if (!baseRef) {
  console.error('Supply --base=<git-ref> for the commit that produced the installed native build.');
  process.exit(2);
}

try {
  const baseFrontendPackage = readBaseJson(baseRef, 'frontend/package.json');
  const baseLock = readBaseJson(baseRef, 'frontend/package-lock.json');
  const baseApp = readBaseJson(baseRef, 'frontend/app.json');
  const baseEas = readBaseJson(baseRef, 'frontend/eas.json');
  const currentPackage = readCurrentJson('frontend/package.json');
  const currentLock = readCurrentJson('frontend/package-lock.json');
  const currentApp = readCurrentJson('frontend/app.json');
  const currentEas = readCurrentJson('frontend/eas.json');

  // Include committed and uncommitted native source files in the comparison.
  const basePaths = baseNativePaths(baseRef);
  const currentPaths = workingNativePaths();
  const nativePaths = [...new Set([...basePaths, ...currentPaths])].sort();
  const actualNativeChanged = stable(nativeDependencies(baseFrontendPackage, baseLock)) !== stable(nativeDependencies(currentPackage, currentLock))
    || stable(nativeConfig(baseApp, baseEas)) !== stable(nativeConfig(currentApp, currentEas))
    || stable(baseNativeTree(baseRef, nativePaths)) !== stable(currentNativeTree(nativePaths))
    || fs.readFileSync(path.join(frontend, 'app.config.js'), 'utf8') !== readBaseFile(baseRef, 'frontend/app.config.js');

  if (actualNativeChanged && !versionWasBumped(baseApp.expo?.version, currentApp.expo?.version)) {
    console.error(`Native-affecting changes require an app version bump before EAS Update. Baseline ${baseApp.expo?.version || 'unknown'}; current ${currentApp.expo?.version || 'unknown'}.`);
    process.exit(1);
  }
  console.log(actualNativeChanged
    ? `Native changes detected; app version advanced from ${baseApp.expo.version} to ${currentApp.expo.version}. EAS Update runtime compatibility check passed.`
    : 'No native-affecting changes detected against the selected build baseline.');
} catch (_) {
  console.error('Could not compare the native runtime baseline. Confirm --base points to a commit available in Git history.');
  process.exit(2);
}

module.exports = { isNativePackageName, versionWasBumped };
