# Wrapchik Setup Guide

Configure local development without changing current database records. Never paste secrets into chat or frontend source.

## Accounts and values

1. **Outlet UPI details** — optional; only needed if the outlet enables UPI. Obtain the outlet-approved UPI ID and payee label, then enter them in Admin → Settings → Customer Payments and enable UPI. The app generates an order-specific amount/reference QR, so no static QR image is needed. Do not use a personal UPI account without outlet authorization.
2. **Email delivery** — real OTP delivery requires backend Gmail SMTP settings (`SMTP_USER`, `SMTP_APP_PASSWORD`); Gmail App Passwords require Google 2-Step Verification. Resend (`RESEND_API_KEY`, `EMAIL_FROM`) is an optional fallback. Do not copy credentials into frontend files.
3. **Expo/EAS account** — required for cloud EAS builds. Keep the existing app identifiers and EAS project ID.
4. **Firebase project** — needed for Android push credentials if using push notifications in a production Android build.
5. **MongoDB Atlas or managed MongoDB** — only for hosted staging/production; local development can continue using local MongoDB.
6. **Google OAuth (optional)** — web, Android, and iOS OAuth client IDs are needed for Google sign-in; see [Google sign-in setup](docs/GOOGLE_SIGN_IN.md). Password and email OTP stay available without it.

## Backend configuration

In PowerShell, create `.env` only if it does not exist:

```powershell
Set-Location 'C:\Users\Tarang\Desktop\wrapchik\wrapchik_upgraded_16\wrapchik\backend'
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

No payment gateway variables are needed for current checkout. Preserve existing backend settings; keep this only if an app return URL is otherwise used:

```dotenv
APP_PUBLIC_URL=http://localhost:8081
```

`APP_PUBLIC_URL` should be reachable by the tester’s browser. Preserve `JWT_SECRET`, `MONGO_URI`, `SMTP_USER`, `SMTP_APP_PASSWORD`, `RESEND_API_KEY`, `EMAIL_FROM` and existing values. `JWT_SECRET` must be at least 32 random characters. No Twilio or payment-gateway variables are needed for email OTP or new checkout.

## Frontend configuration

```powershell
Set-Location 'C:\Users\Tarang\Desktop\wrapchik\wrapchik_upgraded_16\wrapchik\frontend'
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

For laptop web, set in `frontend/.env`:

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:5000
```

For a phone on Wi-Fi, use the laptop’s LAN IPv4 address. For Android emulator use `http://10.0.2.2:5000`. These are public build-time values, not secrets. Restart Expo after changing `.env`.

## Start locally

1. Start MongoDB only if it is stopped.
2. Reuse the existing backend on port 5000. Check `http://localhost:5000/`; if it returns `ACTIVE`, do not start another process. Otherwise:

```powershell
Set-Location 'C:\Users\Tarang\Desktop\wrapchik\wrapchik_upgraded_16\wrapchik\backend'
npm ci
npm run dev
```

3. In a second PowerShell terminal:

```powershell
Set-Location 'C:\Users\Tarang\Desktop\wrapchik\wrapchik_upgraded_16\wrapchik\frontend'
npm ci
npm start -- --web --port 8081
```

Open `http://localhost:8081`. If port 5000 already belongs to the active Wrapchik backend, keep using it; do not start a duplicate.

## New checkout payments

- In Admin → Settings → Customer Payments, enable Cash and/or UPI. Cash is enabled by default. UPI stays disabled until the administrator enters a valid outlet UPI ID and payee name and enables it.
- New UPI orders get an order-specific QR encoding the backend-calculated amount, payee, order ID/reference and note. On Android the standard `upi://pay` URI is handed to Android, which resolves an installed compatible UPI app. If no app opens, the customer can scan the QR from another device.
- UPI reference submission leaves payment pending. Admin → Kitchen & order desk → UPI claims requires actual outlet receipt verification. A reference or screenshot is not bank confirmation.
- For cash, use “Confirm cash received” only after cash is physically received. The backend records verifier ID and timestamp.
- Do not create fake successful orders/payments in the operating database. Use a separate development database for demonstrations.

## Read-only menu integrity report

The backend checker never writes catalogue data. Point it at a database credential with read-only permissions and, if available, provide a JSON file of original `{ "name": "…", "price": 0 }` references:

```powershell
Set-Location 'C:\Users\Tarang\Desktop\wrapchik\wrapchik_upgraded_16\wrapchik\backend'
$env:MENU_AUDIT_MONGO_URI = '<read-only MongoDB URI>'
$env:MENU_REFERENCE_JSON = '<path to original menu reference JSON>'
npm run db:audit-menu
```

The report flags duplicate names, missing images/categories, categories outside the known set, suspect prices, and reference mismatches. Without a supplied source menu, it cannot assert which prices are correct.

## End-term operations added after the mid-term version

- Admin → **Customer insights** lists students with verified order totals. Disabling a student blocks future login/API/socket access and is recorded in the admin audit collection; it does not delete account or order data.
- Admin → **Store settings → Home promotion carousel** manages up to five banners, with optional HTTPS Cloudinary-hosted images, active windows, ordering and fixed internal destinations. Campaigns do not create coupons or change prices. Upload images to the existing Cloudinary media account and paste the resulting `res.cloudinary.com` URL; this codebase does not contain Cloudinary credentials or an in-app upload endpoint.
- Admin → **Store settings → Highlight active orders after** configures the kitchen overdue threshold (1–240 minutes; defaults to 30). Incoming orders trigger a visible alert; web attempts a short tone and native Android/iOS sends haptics. Browser audio may be blocked by browser policy, in which case the visible alert remains.
- A paid takeaway order displays a one-time QR only after the kitchen marks it READY. The token expires in 30 minutes. The administrator scans it with a phone camera while signed in to the Wrapchik admin app; the app route validates the token and marks the order collected. Payment stays as already verified and is never changed by QR scanning. If the QR/deep-link scan is not supported on the device, the existing kitchen order completion action remains available.
- The home screen's **Previously ordered** rail and personalized recommendations appear only when verified completed-order history exists; previously ordered cards use current catalogue prices and availability. No artificial catalogue items or orders are inserted.
- Student-only coupons require an active student account with a verified `@thapar.edu` email. Optional weekday/time windows are enforced by the server in `Asia/Kolkata`, including overnight windows; coupons without these settings retain their prior unrestricted behavior.
- **Meal plans** save current cart product IDs, quantities and customization names locally under the signed-in account. They store no price and re-fetch each menu item before adding a plan to cart. Tomorrow/next-week reminders are local OS notifications (not push delivery); checkout revalidates today's prices and optional pickup slots.
- Cart and checkout directions use a free Google Maps URL on Android, iOS, and web, with the pickup location loaded from public outlet settings and a TIET SAC fallback. No embedded map SDK, API key, GPS permission, or paid Maps service is used.
- Loyalty earning is off by default. An administrator can configure the approved spend block, points per block, paise per point, minimum redemption, maximum redemption percentage (up to 50%), and lifetime tiers under Admin → Store Settings. Enabling requires complete values and a first tier starting at zero. Existing balances are append-only; the app does not apply an expiry policy. Individual-order redemptions are recalculated by the backend and returned if an unpaid order is cancelled or rejected. Group orders do not earn or redeem points.
- Before enabling the loyalty ledger on a separate database, check its additive index migration with `cd backend; npm run db:loyalty-indexes`; use `npm run db:loyalty-indexes -- --apply` only after reviewing the duplicate check. `npm run db:check` reports expected ledger indexes.
- The additive query indexes for order history, kitchen queue, category/availability, product-name search, payment references and group status can be reviewed with `cd backend; npm run db:query-indexes` and created with `npm run db:query-indexes -- --apply`. The preview does not create indexes; neither migration changes order, payment, user or catalogue documents. Production Mongoose auto-indexing is disabled, so review/apply release index migrations explicitly.
- Group invites use `wrapchik://group/<six-character-code>` and redirect to the existing sign-in/join flow. The app still requires a signed-in student before joining.

## Native development build

UPI app launch uses the OS-level `upi://pay` scheme and does not require a gateway native SDK. QR scan remains available if Expo Go cannot launch an installed UPI application. When Android SDK/Java and a test device or emulator are ready:

```powershell
Set-Location 'C:\Users\Tarang\Desktop\wrapchik\wrapchik_upgraded_16\wrapchik\frontend'
npx expo prebuild
npx expo run:android
```

These commands generate native project files and build/install a development app; they are separate from the cloud preview build in `DEPLOYMENT.md`. Existing app IDs and EAS project ID are preserved.

## Configuration still required

- No payment-provider account, key or webhook is required for current checkout.
- Real email delivery: configure Gmail SMTP credentials, or the optional Resend fallback, in `backend/.env`.
- Outlet UPI ID and payee name: **must be supplied and saved by outlet admin before enabling UPI**.
- Firebase push credentials: **not verified/configured**.

## Physical Android testing checklist

- **Expo Go:** phone and laptop must share Wi-Fi. From `frontend`, run `.\scripts\start-android-lan.ps1`; it detects the active laptop LAN IPv4, sets `EXPO_PUBLIC_API_URL` for this Metro session, checks the backend without blocking login/signup screens, and starts Expo Go Metro. Scan its QR in Expo Go. The app never uses localhost or emulator-only `10.0.2.2` for a physical Android phone.
- **Development build:** Google native sign-in and other custom native modules need a development APK (`eas build --platform android --profile development`). Install that APK and start its matching Metro development-client server.
- On the phone, open login, signup, OTP, search and checkout. Tap each input, confirm the keyboard opens, type, submit/dismiss, scroll the form while the keyboard is open, rotate the phone, then retry with airplane mode enabled and disabled.
- Capture Android logs while reproducing: `adb logcat -c; adb logcat | findstr /i "ime focus ReactNative AndroidRuntime Wrapchik"`. In another PowerShell, use `adb devices` to verify the phone is connected.
- Check home → product → cart → checkout, Google sign-in (dev build only), OTP delivery, Socket order updates and app resume. Record OS/device/build, network, timestamp and relevant redacted logs for failures.

Keyboard behavior, Google OAuth and live network behavior are **NOT VERIFIED** until this checklist is run on the physical phone.

## Responsive web screenshot checklist

The current environment did not provide a stable browser window for screenshot capture; web and Android JavaScript exports are not visual verification. On a browser with DevTools, run `npm start -- --web --port 8081`, then inspect and capture these viewport sizes:

| Viewport | Minimum checks |
|---|---|
| 360 × 800 | Login, home, menu, product detail, cart, checkout and order tracking: no horizontal overflow, clipped controls or keyboard-covered fields. |
| 768 × 1024 | Home/menu card columns, nav, filter chips and admin order cards: balanced whitespace and usable touch targets. |
| 1280 × 900 | Customer home/menu and admin dashboard: max-width alignment, readable card density, no stretched food imagery. |

For each, check a loading state, an empty/error state, focus/keyboard behavior, scroll to the first and last actionable control, and capture the screen after the data has settled. Use a separate staging/test account before navigating into order creation; never place a payment or create a demonstration order against the operating database.
