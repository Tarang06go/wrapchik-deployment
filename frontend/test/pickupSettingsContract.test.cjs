const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('admin pickup setting is optional and customer directions stay hidden until configured', () => {
  const admin = read('app/admin/settings.jsx');
  const cart = read('app/(tabs)/cart.jsx');
  const checkout = read('app/checkout.jsx');
  const group = read('app/group-order.jsx');
  assert.match(admin, /value=\{settings\.pickupLocation \|\| ''\}/);
  assert.match(admin, /maxLength=\{200\}/);
  assert.match(cart, /\{pickupLocation \? <TouchableOpacity/);
  assert.match(checkout, /\{getConfiguredPickupPoint\(settings\) \? <TouchableOpacity/);
  assert.match(group, /orderType === 'TAKEAWAY' && pickupLocation \?/);
});
