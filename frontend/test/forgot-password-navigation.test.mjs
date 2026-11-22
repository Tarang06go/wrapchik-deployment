import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const login = readFileSync(new URL('../app/(auth)/login.jsx', import.meta.url), 'utf8');
const recovery = readFileSync(new URL('../app/(auth)/forgot-password.jsx', import.meta.url), 'utf8');

test('Forgot Password carries the entered account email into recovery', () => {
  const matchingLinks = login.match(/router\.push\(\{ pathname: '\/\(auth\)\/forgot-password', params: \{ email: email\.trim\(\)\.toLowerCase\(\) \} \}\)/g) || [];
  assert.equal(matchingLinks.length, 2, 'student and administrator recovery links should both pass the entered email');
  assert.match(recovery, /useLocalSearchParams/);
  assert.match(recovery, /useState\(typeof routeEmail === 'string' \? routeEmail : ''\)/);
});
