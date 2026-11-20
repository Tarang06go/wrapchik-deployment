const iosGoogleClientId = String(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '').trim();
const webGoogleClientId = String(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '').trim();
const androidGoogleClientId = String(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '').trim();

for (const [name, clientId] of Object.entries({ EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: iosGoogleClientId, EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: webGoogleClientId, EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: androidGoogleClientId })) {
  if (clientId && !/^[A-Za-z0-9-]+\.apps\.googleusercontent\.com$/.test(clientId)) {
    const label = name === 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID' ? 'Google iOS OAuth client ID' : 'Google OAuth client ID';
    throw new Error(`${name} must be a ${label}.`);
  }
}

const iosUrlScheme = iosGoogleClientId
  ? `com.googleusercontent.apps.${iosGoogleClientId.replace(/\.apps\.googleusercontent\.com$/, '')}`
  : null;

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins || []),
    ...(iosUrlScheme ? [['react-native-nitro-google-signin', { iosUrlScheme }]] : []),
  ],
  extra: {
    ...(config.extra || {}),
    googleSignIn: {
      iosClientId: iosGoogleClientId,
      iosConfigured: Boolean(iosGoogleClientId),
      webClientId: webGoogleClientId,
      androidClientId: androidGoogleClientId,
      androidConfigured: Boolean(androidGoogleClientId),
    },
  },
});
