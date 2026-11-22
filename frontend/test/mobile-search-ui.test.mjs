import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('home and menu keep a focused search input above a keyboard-persistent result list', () => {
  const home = read('../app/(tabs)/home.jsx');
  const searchBar = read('../components/common/SearchBar.jsx');
  assert.match(home, /onFocus=\{\(\) => setSearchFocused\(true\)\}/);
  assert.match(searchBar, /onKeyPress=\{onKeyPress\}/);
  assert.match(searchBar, /blurOnSubmit=\{false\}/);
  assert.match(home, /searchFocused \? <>[\s\S]*?<FlatList/);
  assert.match(home, /data=\{searchQuery\.trim\(\) \? products : \[\]\}/);
  assert.match(home, /keyboardShouldPersistTaps="always"/);
  assert.match(home, /keyboardDismissMode="none"/);
  assert.match(home, /onPress=\{cancelSearch\}/);
  assert.match(home, /hardwareBackPress/);
  assert.doesNotMatch(searchBar, /onBlur=\{\(\) => setSearchFocused\(false\)\}/);
});

test('search filtering remains local and exposes category, diet and price controls', () => {
  const home = read('../app/(tabs)/home.jsx');
  assert.match(home, /filterCatalogueProducts\(catalogueProducts, \{[\s\S]*?search: '',[\s\S]*?category: selectedCategory,[\s\S]*?diet,[\s\S]*?priceRange,/);
  assert.match(home, /filterCatalogueProducts\(filteredCatalogueProducts, \{ search: searchQuery, sort: null \}\)/);
  assert.match(home, /Filter by category/);
  assert.match(home, /Filter by diet and price/);
  assert.match(home, /No matching items/);
  assert.match(home, /Clear filters/);
});

test('compact browse cards retain two-line names, dietary state and accessible add controls', () => {
  const card = read('../components/product/ProductCard.jsx');
  assert.match(card, /compact = false/);
  assert.match(card, /numberOfLines=\{compact \? 2 : 1\}/);
  assert.match(card, /typeof product\.isVeg === 'boolean'/);
  assert.match(card, /minHeight: 40/);
  assert.match(card, /Add \$\{product\.name\} to cart/);
});
