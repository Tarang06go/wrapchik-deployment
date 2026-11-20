const test = require('node:test');
const assert = require('node:assert/strict');

const configPath = require.resolve('../app.config.js');
const staticConfig = require('../app.json').expo;

const loadConfig = () => {
  delete require.cache[configPath];
  return require(configPath)({ config: staticConfig });
};

test('native Google config remains optional and derives the iOS scheme from its client ID', () => {
  const original = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  try {
    delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    const withoutIos = loadConfig();
    assert.equal(withoutIos.extra.googleSignIn.iosConfigured, false);
    assert.equal(withoutIos.extra.googleSignIn.iosClientId, '');
    assert.equal(withoutIos.plugins.some((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === 'react-native-nitro-google-signin'), false);

    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = '123456789-ios.apps.googleusercontent.com';
    const withIos = loadConfig();
    const plugin = withIos.plugins.find((item) => Array.isArray(item) && item[0] === 'react-native-nitro-google-signin');
    assert.equal(withIos.extra.googleSignIn.iosConfigured, true);
    assert.equal(withIos.extra.googleSignIn.iosClientId, process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
    assert.equal(plugin[1].iosUrlScheme, 'com.googleusercontent.apps.123456789-ios');

    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'not-a-google-client-id';
    assert.throws(loadConfig, /must be a Google iOS OAuth client ID/);
  } finally {
    if (original === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    else process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = original;
    delete require.cache[configPath];
  }
});
