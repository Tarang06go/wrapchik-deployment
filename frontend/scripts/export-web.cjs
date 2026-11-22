const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { copyPwaAssets } = require('./copy-pwa-assets.cjs');

const args = process.argv.slice(2);
let outputDirectory = path.join(__dirname, '..', 'dist');
const outputIndex = args.findIndex((arg) => arg === '--output-dir');
const inlineOutput = args.find((arg) => arg.startsWith('--output-dir='));
if (outputIndex >= 0 && args[outputIndex + 1]) outputDirectory = path.resolve(args[outputIndex + 1]);
else if (inlineOutput) outputDirectory = path.resolve(inlineOutput.slice('--output-dir='.length));
else args.push('--output-dir', outputDirectory);

const expoCli = require.resolve('expo/bin/cli');
const result = spawnSync(process.execPath, [expoCli, 'export', '--platform', 'web', ...args], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
copyPwaAssets(outputDirectory);
