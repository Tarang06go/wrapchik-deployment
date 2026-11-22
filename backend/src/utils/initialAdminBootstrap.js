const TARGET_HOST = 'wrapchik-demo-cluster.piqjl7f.mongodb.net';
const TARGET_DATABASE = 'wrapchik_demo';
const TARGET_DATABASE_USER = 'wrapchik_app';
const BOOTSTRAP_LOCK_ID = 'initial-production-admin-v1';
const APPROVED_IDENTITY = Object.freeze({
  name: 'Wrapchik Admin',
  email: 'wrapchik.admin@gmail.com',
  phone: '+919988218099',
});

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const normalizePhone = (phone) => {
  const value = String(phone || '').trim().replace(/[\s()-]/g, '');
  if (value.startsWith('+')) return value;
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  return value;
};
const phoneLookupValues = (phone) => {
  const normalized = normalizePhone(phone);
  const digits = normalized.replace(/\D/g, '');
  const values = new Set([normalized, digits]);
  if (digits.startsWith('91') && digits.length === 12) values.add(digits.slice(2));
  return [...values];
};

const assertBootstrapTarget = (uri) => {
  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('Enter a valid MongoDB connection URI.');
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (parsed.protocol !== 'mongodb+srv:' || parsed.hostname.toLowerCase() !== TARGET_HOST || database !== TARGET_DATABASE) {
    throw new Error('Bootstrap is restricted to the Wrapchik Demo Atlas cluster and wrapchik_demo database.');
  }
  if (decodeURIComponent(parsed.username) !== TARGET_DATABASE_USER || !parsed.password) {
    throw new Error('Use the existing least-privilege wrapchik_app database user in the connection URI.');
  }
  return { host: TARGET_HOST, databaseName: TARGET_DATABASE };
};

const validateIdentity = ({ name, email, phone }) => {
  const cleanName = String(name || '').trim();
  const cleanEmail = normalizeEmail(email);
  const cleanPhone = normalizePhone(phone);
  if (!cleanName || cleanName.length > 80) throw new Error('Name must be between 1 and 80 characters.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error('Enter a valid admin email address.');
  if (!/^\+[1-9]\d{7,14}$/.test(cleanPhone)) throw new Error('Enter a valid phone number, such as +919876543210.');
  return { name: cleanName, email: cleanEmail, phone: cleanPhone };
};

const validateAdminPassword = (password) =>
  typeof password === 'string' && password.length >= 12 && password.length <= 128
  && /[A-Za-z]/.test(password) && /\d/.test(password);

const assertInitialAdminAvailable = ({ adminCount, existingAccount, existingPhoneAccount, bootstrapLock }) => {
  if (bootstrapLock) throw new Error('The one-time production admin bootstrap has already been used.');
  if (adminCount > 0) throw new Error('An administrator already exists; bootstrap will not create another.');
  if (existingAccount) {
    if (existingAccount.role === 'student') throw new Error('That email belongs to a student. Bootstrap will not promote or modify student accounts.');
    throw new Error('That email is already associated with an account. No account was changed.');
  }
  if (existingPhoneAccount) throw new Error('The approved phone number is already linked to another account. A separate unused admin phone is required; no account was changed.');
};

const buildInitialAdminDocument = (identity, passwordHash) => ({
  ...validateIdentity(identity),
  emailVerified: true,
  phoneVerified: false,
  passwordHash,
  role: 'admin',
  isActive: true,
});

module.exports = {
  TARGET_HOST,
  TARGET_DATABASE,
  TARGET_DATABASE_USER,
  BOOTSTRAP_LOCK_ID,
  APPROVED_IDENTITY,
  assertBootstrapTarget,
  normalizeEmail,
  normalizePhone,
  phoneLookupValues,
  validateIdentity,
  validateAdminPassword,
  assertInitialAdminAvailable,
  buildInitialAdminDocument,
};
