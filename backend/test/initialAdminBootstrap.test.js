const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  TARGET_HOST,
  TARGET_DATABASE,
  TARGET_DATABASE_USER,
  BOOTSTRAP_LOCK_ID,
  assertBootstrapTarget,
  phoneLookupValues,
  APPROVED_IDENTITY,
  validateIdentity,
  validateAdminPassword,
  assertInitialAdminAvailable,
  buildInitialAdminDocument,
} = require('../src/utils/initialAdminBootstrap');

const goodUri = `mongodb+srv://${TARGET_DATABASE_USER}:secret@${TARGET_HOST}/${TARGET_DATABASE}?retryWrites=true&w=majority`;

test('initial admin bootstrap accepts only the intended Atlas host and demo database', () => {
  assert.deepEqual(assertBootstrapTarget(goodUri), { host: TARGET_HOST, databaseName: TARGET_DATABASE });
  for (const uri of [
    'mongodb://127.0.0.1:27017/wrapchik_demo',
    `mongodb+srv://user:pass@other.example/${TARGET_DATABASE}`,
    `mongodb+srv://user:pass@${TARGET_HOST}/wrapchik`,
    `mongodb+srv://other:pass@${TARGET_HOST}/${TARGET_DATABASE}`,
    `mongodb+srv://${TARGET_HOST}/${TARGET_DATABASE}`,
  ]) assert.throws(() => assertBootstrapTarget(uri));
});

test('admin identity is normalized and validates required fields without changing existing users', () => {
  assert.deepEqual(validateIdentity({ name: ' Tarang Agrawal ', email: ' ADMIN@WRAPCHIK.COM ', phone: '98765 43210' }), {
    name: 'Tarang Agrawal', email: 'admin@wrapchik.com', phone: '+919876543210',
  });
  assert.throws(() => validateIdentity({ name: '', email: 'bad', phone: '1' }));
});

test('bootstrap requires a strong password and atomically refuses repeat or student promotion', () => {
  assert.equal(validateAdminPassword('WrapchikAdmin123'), true);
  assert.equal(validateAdminPassword('short123'), false);
  assert.equal(validateAdminPassword('onlyletterslong'), false);
  assert.throws(() => assertInitialAdminAvailable({ adminCount: 0, existingAccount: { role: 'student' }, bootstrapLock: null }), /will not promote/i);
  assert.throws(() => assertInitialAdminAvailable({ adminCount: 0, existingAccount: null, existingPhoneAccount: { role: 'student' }, bootstrapLock: null }), /phone number is already linked/i);
  assert.throws(() => assertInitialAdminAvailable({ adminCount: 1, existingAccount: null, bootstrapLock: null }), /already exists/i);
  assert.throws(() => assertInitialAdminAvailable({ adminCount: 0, existingAccount: null, bootstrapLock: { _id: BOOTSTRAP_LOCK_ID } }), /already been used/i);
  assert.doesNotThrow(() => assertInitialAdminAvailable({ adminCount: 0, existingAccount: null, bootstrapLock: null }));
  assert.deepEqual(phoneLookupValues('+14155550123').sort(), ['+14155550123', '14155550123'].sort());
});

test('created administrator matches the User schema and uses verified admin flags', () => {
  const record = buildInitialAdminDocument({ name: 'Admin', email: 'admin@wrapchik.com', phone: '9876543210' }, 'bcrypt-hash');
  assert.deepEqual(record, {
    name: 'Admin', email: 'admin@wrapchik.com', phone: '+919876543210',
    emailVerified: true, phoneVerified: false, passwordHash: 'bcrypt-hash', role: 'admin', isActive: true,
  });
});

test('operator bootstrap is tied to the approved identity, hidden TTY secrets, and no public creation route', () => {
  assert.deepEqual(APPROVED_IDENTITY, {
    name: 'Wrapchik Admin', email: 'wrapchik.admin@gmail.com', phone: '+919988218099',
  });
  const script = fs.readFileSync(path.join(__dirname, '../src/scripts/bootstrapInitialAdmin.js'), 'utf8');
  assert.match(script, /process\.stdin\.isTTY/);
  assert.match(script, /promptHidden\('New admin password/);
  assert.match(script, /bcrypt\.hash\(password, 12\)/);
  assert.match(script, /session\.withTransaction/);
  const transactionBody = script.slice(script.indexOf('await session.withTransaction'), script.indexOf('}, { readConcern'));
  assert.doesNotMatch(transactionBody, /Promise\.all/);
  assert.match(script, /Atlas rejected the database username or password/);
  assert.match(script, /UnknownTransactionCommitResult/);
  assert.match(script, /api\/admin\/analytics/);
  assert.doesNotMatch(script, /router\.(?:post|put)\([^\n]*bootstrap/i);
});
