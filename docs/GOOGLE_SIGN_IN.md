# Google sign-in (web, Android, and iOS)

Google sign-in is optional on web and native builds for verified `@thapar.edu` accounts. Student password and email OTP login remain available, and administrators continue to use their existing password login. Native Google sign-in uses custom native code and requires a development/production build; it does not run in Expo Go. Backend verification remains authoritative.

To enable it:

1. In Google Cloud Console, create a Web OAuth client and set its ID as `GOOGLE_CLIENT_ID` in `backend/.env`. Add the web origin to authorized JavaScript origins.
2. Create an Android OAuth client using package `com.wrapchik.app` and the SHA-1 certificate fingerprints for each signing certificate used by local/EAS builds.
3. For iOS, create an iOS OAuth client for bundle ID `com.wrapchik.app`; set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` in the EAS environment used to build iOS. The app config derives the URL scheme.
4. Install frontend dependencies and create a new native build after adding OAuth configuration. Rebuild after changing client IDs or signing configuration.

The backend verifies the Google ID token, audience, issuer, expiration, verified Thapar domain, and a short-lived single-use sign-in challenge before issuing a Wrapchik session. New accounts also need a phone number. Do not put client secrets in the frontend or commit `.env` files. Native sign-in must be tested in an EAS development build; Expo web export does not verify Google provider configuration.

Google sign-in requires manually configured OAuth client IDs and signing fingerprints. Without those credentials, the button remains unavailable; password and email OTP remain usable.
