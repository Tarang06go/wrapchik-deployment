import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('student/admin login failures remain visible and login routes stay role-aware', () => {
  const login = read('../app/(auth)/login.jsx');
  assert.match(login, /else setError\(res\.message \|\| 'Invalid credentials'\)/);
  assert.match(login, /adminMode \? 'admin' : 'student'/);
  assert.match(login, /Use your @thapar\.edu student email/);
  assert.match(login, /student-email-input/);
  assert.match(login, /admin-password-input/);
  assert.match(login, /passwordInputRef\.current\?\.focus\(\)/);
  assert.match(login, /GoogleSignInButton/);
  assert.match(login, /forgot-password/);
  assert.match(login, /signup/);
  assert.match(login, /keyboardShouldPersistTaps="handled"/);
});

test('branded splash preserves the cold-launch delay and authenticated destinations', () => {
  const splash = read('../app/splash.jsx');
  assert.match(splash, /3000 - \(Date\.now\(\) - startedAt\.current\)/);
  assert.match(splash, /router\.replace\('\/admin\/dashboard'\)/);
  assert.match(splash, /router\.replace\('\/\(tabs\)\/home'\)/);
  assert.match(splash, /router\.replace\('\/\(auth\)\/login'\)/);
  assert.match(splash, /isReduceMotionEnabled/);
  assert.match(splash, /Animated\.spring\(logoEntrance/);
  assert.match(splash, /copyEntrance/);
});

test('sidebar navigation remains connected to real routes and the router', () => {
  const drawer = read('../components/navigation/AppDrawer.jsx');
  for (const route of [
    '/(tabs)/home', '/(tabs)/menu', '/offers', '/(tabs)/orders', '/group-order',
    '/loyalty', '/favourites', '/support', '/(tabs)/profile', '/settings',
  ]) assert.ok(drawer.includes(route), `sidebar route missing: ${route}`);
  assert.match(drawer, /router\.push\(params \? \{ pathname: route, params \} : route\)/);
  assert.match(drawer, /label: 'Track Order'.*filter: 'ACTIVE'/);
  assert.match(drawer, /label: 'Order History'.*filter: 'COMPLETED'/);
  for (const label of ['Home', 'Menu', 'Deals & Offers', 'Share a Meal', 'Rewards', 'Favourites', 'Support', 'Profile', 'Settings']) assert.ok(drawer.includes(`label: '${label}'`), `sidebar label missing: ${label}`);
});

test('customer settings links only to existing functional account screens', () => {
  const settings = read('../app/settings.jsx');
  for (const route of ['/(tabs)/profile', '/notifications', '/meal-plans', '/support']) assert.ok(settings.includes(route), `settings destination missing: ${route}`);
  const navigation = read('../utils/navigation.js');
  assert.match(navigation, /pathname === '\/settings'.*\(tabs\)\/profile/);
});

test('home exposes real offers, a pageable campaign carousel, popular items, order-again and group ordering', () => {
  const home = read('../app/(tabs)/home.jsx');
  for (const text of ['Deals & offers', 'Popular on campus', 'Order again', 'Share a Meal']) assert.ok(home.includes(text), `home section missing: ${text}`);
  assert.match(home, /snapToInterval=\{promoStep\}/);
  assert.match(home, /promoCarouselRef\.current\?\.scrollTo/);
  assert.match(home, /accessibilityLabel=\{`Open cart with \$\{cartCount\} items`\}/);
  assert.match(home, /Your past picks will show up here/);
});

test('track and history empty states explain their current order filter', () => {
  const orders = read('../app/(tabs)/orders.jsx');
  assert.match(orders, /filter === 'ACTIVE' \? 'No live orders'/);
  assert.match(orders, /filter === 'COMPLETED' \? 'No past orders yet'/);
});

test('home rail uses verified order-history products and product cards animate cart quantity changes', () => {
  const home = read('../app/(tabs)/home.jsx');
  const productCard = read('../components/product/ProductCard.jsx');
  assert.match(home, /previouslyOrderedProducts/);
  assert.match(home, /Order again/);
  assert.match(home, /<ProductCard product=\{product\}/);
  assert.match(productCard, /Animated\.spring\(stepperScale/);
  assert.match(productCard, /addToCartHaptic\(\)/);
});
