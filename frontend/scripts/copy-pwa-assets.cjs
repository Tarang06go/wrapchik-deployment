const fs = require('node:fs');
const path = require('node:path');

function copyPwaAssets(outputDirectory) {
  const projectRoot = path.resolve(__dirname, '..');
  const sourceDirectory = path.join(projectRoot, 'public');
  const destination = path.resolve(outputDirectory);
  if (!fs.existsSync(destination)) throw new Error(`Web export directory does not exist: ${destination}`);
  fs.cpSync(sourceDirectory, destination, { recursive: true, force: true });
  return destination;
}

if (require.main === module) {
  const destination = copyPwaAssets(process.argv[2] || path.join(__dirname, '..', 'dist'));
  console.log(`Copied PWA manifest and assets to ${destination}`);
}

module.exports = { copyPwaAssets };
