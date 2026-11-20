export async function performGoogleSignIn({ webClientId, iosClientId, nonce }) {
  // Import only after the customer taps the button. This lets Expo Go launch the
  // rest of the app even though this native module requires a custom build.
  let google;
  try {
    google = await import('react-native-nitro-google-signin');
  } catch {
    throw new Error('Google sign-in needs a Wrapchik development build. It is not available in Expo Go.');
  }
  google.GoogleOneTapSignIn.configure({
    webClientId,
    ...(iosClientId ? { iosClientId } : {}),
    hostedDomain: 'thapar.edu',
    nonce,
    autoSelectOnSignIn: false,
  });
  await google.GoogleOneTapSignIn.checkPlayServices();
  const response = await google.GoogleOneTapSignIn.presentExplicitSignIn();
  if (google.isCancelledResponse(response)) return { cancelled: true };
  if (!google.isSuccessResponse(response) || !response.data?.idToken) {
    throw new Error('Google did not return a sign-in token. Try again.');
  }
  return { credential: response.data.idToken };
}
