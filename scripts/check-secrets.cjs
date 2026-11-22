const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const trackedFiles = execFileSync('git', ['ls-files', '--cached'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
const untrackedFiles = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
const trackedSet = new Set(trackedFiles);
const files = [...new Set([...trackedFiles, ...untrackedFiles])];
const ignoredPath = /(^|\/)(?:node_modules|\.git|\.expo|dist|coverage|build|\.gradle|\.next)(\/|$)/i;
const envFile = /(^|\/)\.env(?:\.|$)/i;
const sourceExtension = /\.(?:cjs|mjs|js|jsx|ts|tsx|json|ya?ml|md|txt|xml|gradle|properties|sh|ps1)$/i;
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /mongodb(?:\+srv)?:\/\/[^\s/@:]+:[^\s/@]+@/i,
  /\b(?:ghp|github_pat|glpat|xox[baprs])-[-A-Za-z0-9_]{20,}\b/,
  /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/,
  /\bre_[A-Za-z0-9_-]{24,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
];

let findings = 0;
for (const relativePath of files) {
  if (ignoredPath.test(relativePath) || (!trackedSet.has(relativePath) && envFile.test(relativePath)) || /\.env\.example$/i.test(relativePath) || !sourceExtension.test(relativePath)) continue;
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) continue;
  const contents = fs.readFileSync(filePath);
  if (contents.includes(0)) continue;
  const source = contents.toString('utf8');
  if (secretPatterns.some((pattern) => pattern.test(source))) {
    findings += 1;
    console.error(`Potential committed credential found in ${relativePath}. Value suppressed.`);
  }
}

if (findings) process.exit(1);
console.log(`High-confidence secret scan passed (${files.length} Git-visible files checked; ignored local env files were excluded).`);
