import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const screen = readFileSync(new URL('../app/group-cart/[id].jsx', import.meta.url), 'utf8');

test('group checkout displays backend outlet state and blocks checkout unless accepting', () => {
  assert.match(screen, /settingsResult\?\.settings\?\.acceptingOrders === 'boolean'/);
  assert.match(screen, /Outlet is accepting orders/);
  assert.match(screen, /Outlet is closed to new orders/);
  assert.match(screen, /Outlet availability could not be confirmed/);
  assert.match(screen, /disabled=\{acceptingOrders !== true \|\| !quote/);
});
