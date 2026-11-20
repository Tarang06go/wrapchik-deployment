const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const argument = name => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : ''; };
const archivePath = path.resolve(argument('--archive') || '');
const targetDatabase = argument('--target') || '';
const apply = process.argv.includes('--apply');
const mongoUri = String(process.env.MONGO_URI || '').trim();
if (!mongoUri) throw new Error('Set MONGO_URI in backend/.env to the database containing the source archive namespace.');
if (!argument('--archive') || !fs.existsSync(archivePath) || !fs.statSync(archivePath).isFile()) throw new Error('Pass an existing archive with --archive <path>.');
if (!/^[A-Za-z0-9_-]{1,63}$/.test(targetDatabase)) throw new Error('Pass a destination database name using letters, numbers, underscore or hyphen with --target.');

const sourceUrl = new URL(mongoUri);
const sourceDatabase = decodeURIComponent(sourceUrl.pathname.replace(/^\//, ''));
if (!/^[A-Za-z0-9_-]{1,63}$/.test(sourceDatabase)) throw new Error('MONGO_URI must include a simple source database name in its path.');
if (sourceDatabase === targetDatabase) throw new Error('Restore destination must differ from the source database.');

const query = `db.getSiblingDB('${targetDatabase}').getCollectionNames().length`;
const check = spawnSync('mongosh', ['--norc', mongoUri, '--quiet', '--eval', query], { encoding: 'utf8', windowsHide: true });
if (check.error) throw new Error(`mongosh is unavailable for the destination safety check: ${check.error.message}`);
if (check.status !== 0) throw new Error('Could not verify that the restore destination is empty; restore was stopped.');
const collectionCount = Number(String(check.stdout || '').trim().split(/\r?\n/).at(-1));
if (!Number.isInteger(collectionCount) || collectionCount !== 0) throw new Error('Destination database is not empty or its state could not be verified; no data was restored. Choose a new empty database.');

console.log(`Restore preview: ${sourceDatabase} archive namespace -> empty database ${targetDatabase}; no collections will be dropped.`);
if (!apply) {
  console.log('Dry run only. Add --apply to restore into this new empty destination database.');
  process.exit(0);
}

const restore = spawnSync('mongorestore', [
  '--uri', mongoUri,
  '--archive', archivePath,
  '--gzip',
  '--stopOnError',
  '--nsFrom', `${sourceDatabase}.*`,
  '--nsTo', `${targetDatabase}.*`,
], { stdio: 'inherit', windowsHide: true });
if (restore.error) throw new Error(`mongorestore is unavailable: ${restore.error.message}`);
if (restore.status !== 0) throw new Error(`mongorestore failed with exit code ${restore.status}.`);
console.log(`Restore completed into ${targetDatabase}. Validate the restored application before changing any production connection string.`);
