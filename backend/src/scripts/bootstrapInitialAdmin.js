const readline = require('node:readline');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const {
  BOOTSTRAP_LOCK_ID,
  assertBootstrapTarget,
  APPROVED_IDENTITY,
  phoneLookupValues,
  validateAdminPassword,
  assertInitialAdminAvailable,
  buildInitialAdminDocument,
} = require('../utils/initialAdminBootstrap');
const PRODUCTION_API_URL = 'https://wrapchik-api-z7ur.onrender.com';
let currentStage = 'startup';

const prompt = (question) => new Promise((resolve, reject) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(question, (answer) => { rl.close(); resolve(answer); });
  rl.on('SIGINT', () => { rl.close(); reject(new Error('Cancelled.')); });
});

const promptHidden = (question) => new Promise((resolve, reject) => {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    reject(new Error('Run this one-time command in an interactive terminal so secrets can be entered without echo.'));
    return;
  }
  readline.emitKeypressEvents(input);
  const wasRaw = input.isRaw;
  let value = '';
  const finish = (error) => {
    input.removeListener('keypress', onKeypress);
    input.setRawMode(Boolean(wasRaw));
    input.pause();
    process.stdout.write('\n');
    error ? reject(error) : resolve(value);
  };
  const onKeypress = (character, key = {}) => {
    if (key.ctrl && key.name === 'c') return finish(new Error('Cancelled.'));
    if (key.name === 'return' || key.name === 'enter') return finish();
    if (key.name === 'backspace') { value = value.slice(0, -1); return; }
    if (character && !key.ctrl && !key.meta) value += character;
  };
  process.stdout.write(`${question} (hidden): `);
  input.setRawMode(true);
  input.resume();
  input.on('keypress', onKeypress);
});

const verifyProductionLogin = async ({ email, password }) => {
  const baseUrl = PRODUCTION_API_URL;
  try {
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, expectedRole: 'admin' }),
      signal: AbortSignal.timeout(15000),
    });
    if (!login.ok) return false;
    const body = await login.json();
    if (!body?.token || body?.user?.role !== 'admin') return false;
    const headers = { authorization: `Bearer ${body.token}` };
    const [me, adminOrders, adminAnalytics, settings] = await Promise.all([
      fetch(`${baseUrl}/api/auth/me`, { headers, signal: AbortSignal.timeout(15000) }),
      fetch(`${baseUrl}/api/admin/orders?limit=1`, { headers, signal: AbortSignal.timeout(15000) }),
      fetch(`${baseUrl}/api/admin/analytics`, { headers, signal: AbortSignal.timeout(15000) }),
      fetch(`${baseUrl}/api/settings`, { signal: AbortSignal.timeout(15000) }),
    ]);
    if (!me.ok || !adminOrders.ok || !adminAnalytics.ok || !settings.ok) return false;
    const session = await me.json();
    return session?.user?.role === 'admin';
  } catch {
    return false;
  }
};

const sanitizedFailure = (error) => {
  const safeInputMessages = /^(Enter a valid MongoDB|Bootstrap is restricted|Use the existing|Name must|Enter a valid admin|Enter a valid phone|Password does not|Passwords do not|Identity confirmation|An administrator already|That email|The approved phone number|The one-time|Run this one-time|Initial administrator|Bootstrap did not)/;
  if (safeInputMessages.test(error.message || '')) return error.message;
  if (error.code === 18 || error.codeName === 'AuthenticationFailed') return 'Atlas rejected the database username or password.';
  if (error.code === 13 || error.codeName === 'Unauthorized') return 'The Atlas database user lacks a required permission on wrapchik_demo.';
  if (error.code === 11000) return 'A duplicate user or bootstrap lock was detected. No student account was changed; inspect the admin and lock counts before retrying.';
  if (error.hasErrorLabel?.('UnknownTransactionCommitResult')) return 'Atlas could not confirm whether the transaction committed. Do not retry yet; check the admin and bootstrap-lock counts first.';
  if (error.hasErrorLabel?.('TransientTransactionError')) return 'Atlas aborted a transient transaction. The transaction was rolled back; it is safe to retry once.';
  if (error.name === 'MongoServerSelectionError' || error.name === 'MongoNetworkError') return 'Could not reach Atlas. Check the temporary IP access-list entry and network connectivity.';
  if (/transaction numbers are only allowed|transactions are not supported/i.test(error.message || '')) return 'Atlas rejected transaction support for this connection.';
  const safeCode = Number.isInteger(error.code) ? `code ${error.code}` : `type ${String(error.name || 'Error').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'Error'}`;
  return `Unexpected failure (${safeCode}). No credential values were logged; check this operation before retrying.`;
};

const run = async () => {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Run this one-time command in an interactive terminal.');
  console.log('One-time Wrapchik production admin bootstrap. No student account will be promoted.');
  currentStage = 'database target input';
  const mongoUri = await promptHidden('Paste the existing Atlas app connection URI');
  const target = assertBootstrapTarget(mongoUri);
  console.log(`Target verified: ${target.host}/${target.databaseName}`);

  const identity = APPROVED_IDENTITY;
  currentStage = 'approved identity confirmation';
  const confirmation = await prompt(`Type the approved admin email exactly (${identity.email}) to confirm: `);
  if (confirmation.trim().toLowerCase() !== identity.email) throw new Error('Identity confirmation did not match; no database change was made.');

  currentStage = 'password confirmation';
  const password = await promptHidden('New admin password (12–128 characters, at least one letter and one number)');
  const passwordAgain = await promptHidden('Confirm admin password');
  if (!validateAdminPassword(password)) throw new Error('Password does not meet the required length and complexity. No database change was made.');
  if (password !== passwordAgain) throw new Error('Passwords do not match. No database change was made.');

  currentStage = 'Atlas connection';
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000, autoIndex: false, dbName: target.databaseName });
  currentStage = 'read-only preflight';
  const [preflightAdminCount, preflightAccount, preflightLock] = await Promise.all([
    User.countDocuments({ role: 'admin' }),
    User.findOne({ email: identity.email }).select('_id role'),
    mongoose.connection.collection('adminBootstrapLocks').findOne({ _id: BOOTSTRAP_LOCK_ID }),
  ]);
  const preflightPhoneAccount = await User.findOne({ phone: { $in: phoneLookupValues(identity.phone) } }).select('_id role');
  assertInitialAdminAvailable({ adminCount: preflightAdminCount, existingAccount: preflightAccount, existingPhoneAccount: preflightPhoneAccount, bootstrapLock: preflightLock });
  const existingCollection = await mongoose.connection.db.listCollections({ name: 'adminBootstrapLocks' }).hasNext();
  currentStage = 'bootstrap lock collection';
  if (!existingCollection) await mongoose.connection.createCollection('adminBootstrapLocks');
  const lockCollection = mongoose.connection.collection('adminBootstrapLocks');
  const session = await mongoose.startSession();
  let created = false;
  try {
    currentStage = 'single-use admin transaction';
    await session.withTransaction(async () => {
      // The MongoDB Node driver does not support parallel operations on one transaction session.
      // Keep these checks sequential so the one-time create and lock commit atomically.
      const adminCount = await User.countDocuments({ role: 'admin' }).session(session);
      const existingAccount = await User.findOne({ email: identity.email }).session(session).select('+passwordHash');
      const existingPhoneAccount = await User.findOne({ phone: { $in: phoneLookupValues(identity.phone) } }).session(session).select('_id role');
      const bootstrapLock = await lockCollection.findOne({ _id: BOOTSTRAP_LOCK_ID }, { session });
      assertInitialAdminAvailable({ adminCount, existingAccount, existingPhoneAccount, bootstrapLock });

      const passwordHash = await bcrypt.hash(password, 12);
      const user = new User(buildInitialAdminDocument(identity, passwordHash));
      await user.save({ session });
      await lockCollection.insertOne({ _id: BOOTSTRAP_LOCK_ID, createdAt: new Date(), userId: user._id }, { session });
      created = true;
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } finally {
    await session.endSession();
  }

  if (!created) throw new Error('Bootstrap did not create an account.');
  console.log('Initial administrator created. No credentials were printed.');
  currentStage = 'production login and authorization verification';
  if (await verifyProductionLogin(identity)) {
    console.log('Production admin login, authenticated session, admin orders/analytics access, and settings endpoint verified.');
  } else {
    console.warn('Account creation succeeded, but live admin route/session verification could not be confirmed. Check service readiness and login configuration; do not rerun bootstrap.');
  }
};

run()
  .catch((error) => {
    if (error.message === 'Cancelled.') {
      console.error('Admin bootstrap cancelled. No credentials were printed.');
    } else {
      console.error(`Admin bootstrap stopped during ${currentStage}: ${sanitizedFailure(error)} No credentials were printed.`);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect().catch(() => {});
  });
