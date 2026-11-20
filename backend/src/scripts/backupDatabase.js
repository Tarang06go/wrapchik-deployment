const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const mongoUri = String(process.env.MONGO_URI || '').trim();
if (!mongoUri) throw new Error('Set MONGO_URI in backend/.env before taking a database backup.');
const outputArg = process.argv.indexOf('--output');
const outputPath = outputArg >= 0 ? path.resolve(process.argv[outputArg + 1] || '') : path.resolve(__dirname, '../../backups', `wrapchik-${new Date().toISOString().replace(/[:.]/g, '-')}.archive.gz`);
if (!outputPath || outputPath === path.parse(outputPath).root) throw new Error('Choose a valid backup file path.');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });

console.log(`Writing compressed MongoDB archive to ${outputPath}`);
const result = spawnSync('mongodump', ['--uri', mongoUri, '--archive', outputPath, '--gzip'], { stdio: 'inherit', windowsHide: true });
if (result.error) throw new Error(`mongodump is unavailable: ${result.error.message}`);
if (result.status !== 0) throw new Error(`mongodump failed with exit code ${result.status}.`);
console.log('Backup completed. Keep this archive encrypted and outside source control.');
