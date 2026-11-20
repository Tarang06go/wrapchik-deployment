# Wrapchik Master Upgrade Progress

One checklist line per task; statuses record actual work and verification.

> **Status freshness:** the original phase checklist below records earlier audit snapshots. The dated “Current P1–P4 implementation and verification” addendum at the end supersedes conflicting counts and feature statuses.

- [x] Source baseline: use `docs/WRAPCHIK_FULL_PROJECT_AUDIT.md`; no repository Git metadata exists, so branch/commit steps are unavailable.
- [x] P0.1 Group-cart role derivation crash: extracted pure utility, moved role derivation after state initialization, and added regression tests (frontend suite 12/12 passes).
- [x] P0.2 Bounded storage: added 3-second safe adapter with separate AsyncStorage/SecureStore memory fallbacks; migrated cart, auth token/profile/session cleanup, and checkout idempotency; stalled/rejected storage tests pass.
- [~] P0.3 Android keyboard/touch audit: reviewed shared Input, login/signup/OTP/search/checkout, scroll touch persistence, modals, `adjustResize` and config. Removed dev-only diagnostic route. Android folder is locally ignored/untracked (no Git metadata); native prebuild comparison and physical keyboard test remain NOT VERIFIED.
- [x] P0.4 Native-only navigation: reviewed URL/openURL usage, added `npm run check:routes`; current route check covers 21 targets. Existing payment/group and platform-guarded map intents remain explicit.
- [~] P0.5 Login reliability: Expo Go/unconfigured Google messaging and student email OTP fallback are reachable; signup entry added and admin password login retained. Google Cloud/EAS IDs documented but real OAuth/device flows remain NOT VERIFIED.
- [~] P0.6 Network resilience: 15s API timeout, two exponential retries on idempotent GETs, offline banner/retry, foreground authoritative refetch, backend `/health` and strict production `CORS_ORIGIN`. Socket authentication uses per-user/admin rooms, and group updates now target joined members only; authenticated two-user behavior remains NOT VERIFIED.
- [~] P0.7 Expo hygiene: `npx expo install --check` passed against bundled local map; network lookup unavailable. `npx expo-doctor` could not complete because network access was unavailable.
- [x] P0.8 Group entry points: Share a Meal CTA added to Home and Profile.
- [~] P0 verification: latest full backend tests pass 101/101, frontend tests 16/16, route check 21/0 missing; web and Android JS exports passed before the meal-plan screen was added and must be rerun. Live `/health`, `/`, `/api/products`, `/api/settings`, and paired recommendations returned expected read-only responses with MongoDB connected. Physical-device, Expo Doctor, Google and authenticated socket journeys remain NOT VERIFIED.
- [x] P1.1 Menu integrity: added `npm run db:audit-menu`, a required `--dry-run`, explicit read-only-URI audit with optional trusted menu-reference JSON; it never falls back to the app URI or writes catalogue data. Actual database/reference report NOT RUN because no read-only audit URI/reference was supplied.
- [~] P1.2 Browse/discover: current categories, diet/search/sort/featured/popular/unavailable/customizations retained; recent-search and price filters are present. Added verified-order co-purchase and personalized recommendation endpoints/UI with a 30-second cache. Student-only and weekday/time coupons now validate server-side and are configurable in admin. No full current-catalogue screen sweep or user journey.
- [x] P1.3 Cart/checkout/inventory: server pricing, snapshots, idempotency and optional atomic finite stock are implemented; null stock remains unlimited for existing products. Stock reservations are restored on order failure, invalid total, customer cancel, and admin reject/cancel. Tests cover oversell and rollback; no live order was created.
- [~] P1.4 UPI/cash: existing order-specific UPI, pending/manual admin verification, replay protection and cash-at-counter confirmation preserved and covered by backend tests. No actual payment or admin receipt verification was performed.
- [~] P1.5 Order lifecycle: existing state machine, cancellation, reorder, tracking, history and notifications preserved. No authenticated end-to-end customer/admin lifecycle was run; live ETA and completed-order review flow remain unverified.
- [x] P1.6 Admin: added protected paginated customer insights, verified-order totals, student-only account disable/enable with append-only audit and socket disconnection; added an optional text promotion banner with fixed internal-route choices, disabled by default. Kitchen/order analytics and existing CRUD retained.
- [~] P1 verification: backend regression suite 101/101, including auth/RBAC, payment integrity, student/time coupon rules, stock concurrency, customer audit, banner validation, group socket privacy, pickup token and recommendation tests; frontend 16/16. Live health/catalogue/settings reads passed. No non-production order/customer mutation journey was run.
- [~] P2.1 Share a Meal: existing invite/group cart, shared dishes, splits, Host Pays, integer-paise allocation and outlet reconciliation retained; group cart crash was already fixed and entry point is visible. Group broadcasts now go only to current members. API two-user/session scenario and device run NOT VERIFIED.
- [x] P2.2 QR pickup: added HMAC-SHA256 signed 30-minute tokens (only SHA-256 digest stored), customer tracking QR and protected atomic admin verification for paid READY non-group takeaway orders. QR consumption records the verifying admin and timestamp and cannot alter payment status. Controller/token tests pass; physical camera/deep-link scan NOT VERIFIED.
- [~] P2.3 Recommendations: added co-purchase and “Because you ordered” API/UI derived only from verified completed orders; unavailable/out-of-stock items are excluded and results cache for 30 seconds. Runtime route returned safely with an empty result because no matching completed-order data was present.
- [~] P2.4 Scheduling/notifications/tracking: existing scheduled pickup, in-app notifications, Expo push registration, Socket.IO updates, and order timelines retained. Added private on-device saved meal baskets with menu revalidation before reordering and local tomorrow/next-week reminders. Provider/device delivery and two-user real-time journey NOT VERIFIED.
- [ ] P2.5 Loyalty rewards: not implemented. The source/plan supplies no earning rate, redemption value, expiry, or reward tiers. Do not change order totals until the outlet sets those financial rules.
- [~] P2.6 Student/time-limited offers, meal plans/reminders, directions and streaks: server-enforced verified-student/time-window coupons, local meal plans/reminders and free platform map intents are implemented. No approved campus block/pickup-point directory or streak rules were supplied; those remain unimplemented.
- [~] P2 verification: group allocation, contribution/manual payment safeguards, pickup token replay/expiry, recommendation filtering/cache covered by unit tests; two-user group, QR scan, push and real-time device run remain NOT VERIFIED.
- [~] P3 design system: existing Wrapchik theme, shared components, loading/error/empty/skeleton states, safe areas and responsive home grid retained. Home now has optional admin promotion and horizontally scrollable popular/personalized rails.
- [~] P3 interaction/responsiveness: recommendation rails/map action are responsive and a route error boundary now provides retry UI. No full rendered customer/admin screen audit, screenshot pass, TalkBack, reduced-motion, system dark-mode override, haptics, or physical touch test was performed. Rerun exports after meal plan route changes.
- [~] P3 verification: frontend tests, route check and both platform JS exports pass. These do not prove visual quality or native behavior.
- [~] P4 security: disabled students are blocked from password, OTP, Google, protected API and socket access; admin changes are logged. Added recursive Mongo operator/path input sanitization and process-local payment/group rate limits. Group socket events exclude former members. No destructive database operation or live payment occurred.
- [~] P4 performance/quality: dependency tree clean, Expo SDK local version check passes (network version lookup unavailable), backend 101/101 + frontend 16/16 tests pass, route check 21/0 missing. Web/Android exports passed before the new meal-plan route and need a final rerun. No APK/Gradle/iOS build, Expo Doctor or full secret-history scan.
- [~] P4 docs/deployment: API and setup docs cover student/time coupons, local meal plans/directions, customer/admin controls, promotion, pickup QR and recommendations. Added compressed Mongo dump and isolated restore scripts plus procedures, and CI workflow. No deploy, Atlas backup/restore rehearsal, EAS archive inspection or EAS cloud build.
- [~] P4 cleanup/CI: CI workflow is added for clean installs, backend/frontend tests, route check, Expo dependency compatibility and web/Android exports. No Git metadata exists, so no branch/history/commit review or cleanup can be asserted. Production deployment and signed artifacts remain unfinished.

## Current P1–P4 implementation and verification — 2026-11-20

This addendum is the current state; it supersedes older counts and TODO statements above. It separates code and automated verification from device, provider, and production verification.

### P1 — Core ordering, checkout, authentication, and administration

- **Implemented:** server-authoritative checkout and immutable order snapshots, inventory reservation/rollback, coupon and reward quotes, order state transitions, manual UPI/cash verification, student/admin authorization, customer administration, oldest-first active kitchen queue, overdue highlighting with an admin-configurable threshold, and rejection requiring a reason. New-order notifications provide a visual alert, with a short web sound attempt and native haptic where available.
- **Implemented:** checkout now exposes outlet directions through platform map links. The existing customer checkout still relies on backend-calculated totals; app/payment callbacks do not mark payments paid.
- **Automated verification:** backend test suite **126/126**, frontend test suite **20/20**, route check **22 targets / 0 missing**. No live order, payment, or authenticated customer/admin workflow was created or exercised in this pass.
- **Still unverified:** real Google OAuth, OTP email delivery, real gateway/provider reconciliation, and full user journeys against an isolated test database. Menu integrity audit was not run because a separate read-only database URI and trusted reference catalogue were not supplied.

### P2 — Group ordering, rewards, scheduling, notifications, and tracking

- **Implemented:** existing group invitations, group cart, integer-paise splits, Host Pays and manual contribution review remain in place. A bounded periodic sweeper now cancels only expired OPEN groups using a conditional atomic update and emits the resulting group update. It is safe to rerun and does not touch order/payment records.
- **Implemented:** the loyalty service, checkout quote, history and admin policy controls are present. Earning/redemption stay controlled by outlet settings; no reward value was invented or enabled by this implementation. Existing scheduled orders, local meal plans/reminders, in-app/push notification registration, tracking and pickup QR remain implemented.
- **Still unverified:** two-account live group flow, native QR scan, push receipt, and socket update delivery on devices. Streak rules and an approved campus pickup-point directory are absent from the project requirements and remain unimplemented.

### P3 — Product UI and responsiveness

- **Implemented:** admin-managed promotion carousel with up to five HTTPS Cloudinary-hosted image/text campaigns, fixed in-app CTA routes, scheduling window, ordering, and archive/disable controls. Home displays only currently active campaigns while preserving the legacy single-banner setting. Checkout provides an outlet-directions action.
- **Implemented:** shared small-button/touch targets now meet 48dp/pt minimums, and kitchen orders visibly highlight when overdue.
- **Still unverified:** a reliable rendered screenshot review at phone/tablet/desktop widths, TalkBack/VoiceOver, Android/iOS keyboard and haptics, animations, and native transitions. The setup guide contains a reproducible screenshot-size checklist. Campaign image upload is not wired to Cloudinary; administrators must upload there and paste the HTTPS URL.

### P4 — Security, data integrity, performance, and release

- **Implemented:** production Mongoose `autoIndex` is disabled. Additive query-index migrations have read-only dry runs, detect already-present indexes and option conflicts, and do not edit documents. The loyalty/review migration preflights duplicates before adding any missing unique indexes. Backend API documentation and setup/deployment guidance include the new admin settings and safe migration steps.
- **Verification:** `npm test` backend **126/126**; frontend `node --test` **20/20**; `npm run check:routes` **22/22 present**; `npx expo install --check` **passes local bundled map** (network-backed compatibility validation unavailable); frontend/backend `npm ls --depth=0` **clean**; Expo web and Android JavaScript exports **pass**.
- **Database checks:** read-only query-index dry run reports **0 missing indexes**. Loyalty/review duplicate preflight is clean and the corrected planner confirms **0 missing feature indexes**. No documents or indexes were changed. EAS identity lookup could not resolve `api.expo.dev`; Expo Doctor could not query package metadata.
- **Not release verified:** real OAuth clients/signing, HTTPS production API and CORS, live inbox/push/payment provider, Android/iOS device behavior, native signed builds, production deployment, CI execution, and Atlas backup/restore rehearsal. No database migration was applied and no customer/order/payment data was changed.

### Current remaining blockers

- Supply Google Web/Android/iOS OAuth client IDs and the EAS Android signing SHA-1; set the backend Google client ID.
- Restore network/DNS access and EAS authentication before requesting a preview APK; ensure `EXPO_PUBLIC_API_URL` points to the deployed HTTPS API and production `CORS_ORIGIN` allows the app origin.
- Provide an isolated test database/account setup for full customer/admin and two-user workflows. Do not use production records for those tests.
- Connect an Android device/ADB and an iOS device/build environment for native input, navigation, QR, push and accessibility verification.
- Confirm campus pickup locations and any loyalty/streak financial/business rules before adding those policies.

## BLOCKERS

- No connected Android device/ADB evidence is available in this session; keyboard, Google chooser, pickup QR scan, Expo Go recovery, push delivery, socket events and two-user group behavior remain device NOT VERIFIED.
- Google OAuth client IDs are blank in local frontend config (`web`, `android`, `ios`); backend `GOOGLE_CLIENT_ID`, OAuth consent/client setup and EAS signing SHA-1 must be confirmed before live student Google sign-in.
- Expo Doctor could not run to completion because network access is unavailable; `expo install --check` used the SDK-bundled local version map.
- No Git metadata is present, so branch/commit or committed-secret history checks cannot be done. A local Android signing keystore exists; `.jks`/keystore files are now ignored and excluded from EAS archives, and the existing file was preserved.
- EAS cloud authentication, HTTPS production API/CORS values, external deployment, Atlas backup/restore rehearsal, Gmail OTP delivery, push receipts, real payment verification and iOS build/device are not available/verified here.
- Google OAuth requires Web/Android/iOS client IDs, matching package/bundle registrations, consent configuration and the EAS Android signing SHA-1. Student/admin sessions were not used for live journey tests.
- Loyalty requires outlet-approved points earning, redemption conversion, tier and expiry rules. No such rules are present, so discounts were not invented.
- No menu reference JSON or separate read-only menu-audit URI was supplied; menu price/integrity findings are not asserted.
- Loyalty point value/redemption rules, streak policy, campus location directory, substantial P3 visual/accessibility/device QA, Expo Doctor, actual CI run, production deployment and signed device builds remain. Do not represent the full master prompt as complete.

## Menu screenshot import — 2026-11-20

- Transcribed **66 unique screenshot rows** after deduplicating six repeated appearances. Imported the **61 rows with complete names**; held five ellipsized names for review.
- Matched and updated two existing products in place (`Crispy Veg Patty Wrap` → `Veg Crispy Wrap`, and `Peri Peri Masala Fries` → `Peri Peri Fries`); added 59 products and the missing `Salads` and `Snacks` categories. Final local development catalogue: **65 products, 6 categories, 0 normalized duplicate groups**.
- Added source-checked Unsplash 1200×1200 product image URLs to 51 new items; retained both matched products' existing images. Eight products have no verified, product-relevant photo yet and use the UI fallback. Two clipped descriptions were left blank. Source attribution and importer commands are in `docs/MENU_IMAGE_SOURCES.md`.
- Added resilient image loading/fallbacks in customer cards, home recommendations, product details, cart/group cart, and admin inventory. Unknown dietary classification now stays unlabelled instead of defaulting to Veg; admin can set Veg, Non-veg, or Unknown.
- Backend product validation now permits missing descriptions and images. New product classification defaults to unknown; this supports the screenshot data without inventing ingredients, photos, or dietary claims.
- **Verification:** importer dry-run matched the initial 6-product database (2 updates, 59 creates, 2 categories, 5 held rows); idempotent post-import run passed against the final catalogue. Read-only `GET /api/products` returned 65 products and `GET /api/categories` returned 6 categories; API data had 57 image URLs, 51 new 1200px Unsplash renditions, 8 unclassified foods and 0 normalized duplicates. Backend suite **129/129**, frontend suite **20/20**, route check **22/22**, Expo web export and Expo Android JS export passed. No physical-device image rendering was tested.
- **Needs review:** five truncated product names; image matches for Diet Coke, Pepsi, Cheesy Fries, Paneer Popcorn, Veg Cheese Nuggets and three nacho salads; clipped descriptions for Iced Coffee Latte and Truffle Fries. The branded can images remain blank until approved, non-infringing brand photos are supplied.

## Physical Android follow-up — 2026-11-20

- **Fixed:** `stock: null` means unlimited, but customer card and product detail checks converted it to numeric zero and disabled Add for the entire imported catalogue. Shared availability logic now treats only finite zero/negative stock as sold out; tests cover null, missing, finite and explicit-unavailable cases.
- **Fixed:** admin pickup route no longer statically imports `expo-camera`. It loads the native camera module only when scanning is requested, catches missing-module failures, and leaves manual order/code verification usable in Expo Go.
- **Network diagnosis:** frontend URL is `http://10.31.15.58:5000/api`, matching the laptop's current Wi-Fi IPv4. The backend is healthy, connected to MongoDB, and listens on `0.0.0.0:5000`. The active Wi-Fi profile is Public and has no inbound port-5000 rule. A narrowly scoped rule (Node.js, TCP 5000, local subnet only) could not be added because this shell lacks Windows administrator rights; the user must run the provided command in an elevated PowerShell. Phone connectivity therefore remains NOT VERIFIED until that rule exists and the phone shares the same LAN.
- **Verification:** frontend suite **23/23**, route check **22/22**, Expo web and Android JS exports passed; SDK dependency check passed using the local SDK57 package map (network unavailable). No physical phone/Expo Go runtime test was possible. Expo Go's native module set is fixed; QR camera scanning requires a compatible Expo Go SDK or a Wrapchik development build.

## Mobile connectivity, payment lifecycle, and navigation update — 2026-11-20

- **Fixed the payment render loop/cart lifecycle:** `clearCart` now has a stable callback; the payment screen only fetches its order and never clears a shared cart; checkout clears the cart and idempotency key only after the backend returns a newly created non-cancelled order. Opening an old pending payment no longer erases another cart. Empty checkout now shows a menu action instead of a zero-value order summary. A source-level regression test protects this lifecycle.
- **Fixed offline-state inversion:** API events report `online`, but the offline banner previously treated that value as `offline`. It now displays only for failed connectivity, can be dismissed, includes a working retry action, reserves Android safe-area space, and stays in document flow instead of covering the header.
- **Updated local LAN configuration:** `.env` previously pointed to `10.31.15.58`; the active Wi-Fi IPv4 is now `172.16.211.89`. The local public API URL was updated, and `frontend/scripts/start-android-lan.ps1` remains the preferred dynamic configuration so the IP is not fixed in application source. Created `MOBILE_TESTING.md` with Expo Go, dev-client, and preview-build instructions.
- **Backend runtime diagnosis:** the existing Wrapchik backend is PID **54208** (`src/scripts/devServer.js`), listening on `0.0.0.0:5000`; MongoDB is connected. `GET /health` and `GET /api/products` returned healthy responses through loopback and the current LAN IP. The catalogue has **65 products; all 65 are available with unlimited stock; none are marked unavailable or zero-stock**. A second startup attempt hit EADDRINUSE and was stopped; the existing server was reused. No firewall rule, user, order, payment, or catalogue record was changed.
- **Expo Go camera safety:** the pickup camera remains dynamically imported only after Scan is tapped, with manual one-time code entry available when Expo Go lacks ExpoCamera. A development build is required for native scanning when the installed Expo Go binary does not include the module.
- **Student access and navigation polish:** student email/password is available alongside Google Sign-In and email OTP. Password requests now state the expected `student` or `admin` role; mismatched-role credentials receive the existing generic login failure. Admin password login and existing accounts remain intact. Added a five-tab Home/Menu/Orders/Cart/Profile bar, an animated accessible profile drawer, an offers view backed by the authenticated coupon API, circular category thumbnails, quick-add haptics, and a branded three-second splash that respects Reduce Motion. Outlet directions use configured pickup location with the existing TIET fallback.
- **Automated checks:** backend **130/130**, frontend **26/26**, route check **24 targets / 0 missing**, Expo SDK compatibility check passed against the local SDK57 package map, web export passed, and Android JavaScript export passed. Both exports were generated in temporary folders and removed after verification.
- **Still not verified:** physical OnePlus/Expo Go input, Android UPI chooser/callback, camera scan, push/socket receipt, Google OAuth, and phone-to-laptop LAN connectivity. Laptop requests to its LAN address work, but Windows firewall or Wi-Fi client isolation may still block the phone; no firewall change was attempted. The pre-existing APK will not receive new API/configuration or JavaScript changes automatically. Preview APKs require the configured deployed HTTPS backend; local HTTP testing uses Expo Go or a development client.

### Live local checks — 2026-11-20

- Rechecked the existing runtime without starting another server: backend `/health` returned HTTP 200 via loopback and Wi-Fi IP `172.16.211.89`; MongoDB is connected. Expo `/status` returned `packager-status:running` via both addresses.
- Read-only `/api/products` returned 65 products, with 0 unavailable, 0 zero-stock, and 0 zero-price items. These laptop-side checks do not verify phone-to-laptop access.
- `MOBILE_TESTING.md` now includes the process-scoped LAN helper command and the optional, local-subnet-only Windows firewall rule/removal command. No firewall settings or database records were changed.

## Password recovery, SDK mismatch, and final mobile polish — 2026-11-20

- **Password recovery false-offline fix:** API requests now carry monotonic sequence numbers. A no-response failure can show the app-wide offline banner only when it belongs to a request started after the latest successful response; late failures from older in-flight requests are ignored. Recovery-code sends are guarded against duplicate taps, HTTP-200 success clears stale screen errors, and the existing screen advances to its OTP entry step using server expiry/cooldown values.
- **Development workflow:** documented that Expo Go SDK 58 cannot open this Expo SDK 57 project. No Expo or React Native dependency was changed. Added exact EAS Android development-client build/install and LAN Metro commands for native Google Sign-In and camera support.
- **Mobile polish:** newly placed cash orders and orders with backend-verified UPI payment get a short orange/gold celebration. It is disabled for declined/cancelled orders, history visits, and reduced-motion settings. Payment status remains server-authoritative.
- **Regression tests:** added network-event ordering, password-reset success/failure/double-submit guard, UPI launch/payment-state, login error, splash destination, sidebar route, and order-celebration tests.
- **Verification:** frontend **37/37**, backend **130/130**, route check **24 targets / 0 missing**, Expo SDK dependency check passes from the local SDK 57 map, web export passes, and Android JS export passes. No native build/device run was performed; ADB is unavailable on PATH. The backend Google client ID exists locally, but frontend Google OAuth client IDs are not set in local `.env` files; live Google sign-in remains unverified.

## Final completion pass — 2026-11-20

- **UPI:** Added a copy-URI fallback beside the existing QR and native app launch. The copied URI comes from backend-generated payment instructions (amount, merchant and order reference); launch and transaction-reference submission now guard against duplicate in-flight actions. Redirect/copy never marks payment paid; admin verification remains authoritative.
- **Homepage/history:** Added a “Previously ordered” rail backed by verified completed, paid order history and current catalogue records. It reuses the existing recommendations API call and normal product cards/prices/availability; missing catalogue entries are skipped and products are deduplicated.
- **Pickup directions:** Uses the free Google Maps universal URL on web, Android and iOS, with pickup location fetched from outlet settings and the existing TIET fallback. No Maps API key is required.
- **Mobile polish:** Product quantity changes now animate with a native spring while retaining existing haptics. Docs cover the order-history rail, UPI fallback and platform-independent Maps URL.
- **Automated verification:** Frontend `node --test` **40/40**; backend `node --test --test-concurrency=1` **131/131**; route check **24 targets / 0 missing**; Expo dependency check passes using the local SDK 57 bundle map (network metadata unavailable); frontend and backend dependency trees are clean; web, Android JS and iOS JS exports all pass. An initial parallel backend test run hit a transient localhost-port error; the isolated rate-limit test and full serial suite both passed.
- **Runtime/device boundary:** This session could not access the live backend health socket due sandbox socket restrictions. No physical Android/iOS test, native signed build, installed UPI chooser, Google OAuth, camera, push, accessibility or screenshot review is claimed. JS exports validate bundling, not native runtime.
- **Remaining external setup:** Google Web/Android/iOS OAuth client IDs, consent/client registrations, backend Google client ID and matching EAS Android SHA-1; reachable HTTPS production API/CORS plus EAS credentials for a preview build; native device verification. Gmail SMTP, push delivery, payment-provider verification and outlet-approved loyalty policy also depend on configured external services/business rules. No credentials were placed in source or exposed.

## Mobile UI/UX completion pass — 2026-11-20

### Implemented in source

- **Student/admin sign-in:** preserved student email/password, Continue with Google, email OTP fallback, Forgot Password, Create Account and separate admin password entry. Login inputs now advertise email/current-password autofill, submit/advance with the keyboard, retain handled taps while scrolling, dismiss the keyboard on submit, and receive safe-area padding. Existing Android `adjustResize` configuration remains in place; no authentication business logic changed.
- **Cold-launch splash:** kept the minimum three-second branded display and auth-restoration gate. The W mark now springs/rotates into place while the brand copy fades upward; Reduce Motion disables the animation. Resolved admin, student and signed-out sessions route to their correct destinations.
- **Customer home:** active outlet campaigns now snap as a horizontal carousel with accessible page indicators; an always-visible Deals & Offers CTA opens the real coupon screen without inventing a discount. Popular products, categories, Share a Meal, floating cart and verified history products remain data/API backed. Signed-in customers without history get a useful order-again prompt instead of a missing section.
- **Navigation:** drawer entries now separately include Home, Menu, Deals & Offers, Track Order, Order History, Share a Meal, Rewards, Favourites, Support, Profile, Settings and Logout. Track Order opens the active filter; Order History opens completed/past orders. Added a Settings hub linking only to existing profile, notifications, meal-plan and support screens, plus an explicit drawer close action and tap/haptic feedback. Settings has a safe back fallback.
- **Mobile interaction:** bottom tab-bar sizing now includes the device bottom inset. Category taps use the existing haptic utility. Route checking now also validates navigation descriptors such as the drawer and settings menu.

### Automated checks

- Frontend `node --test`: **45/45 passed**.
- Backend `npm test -- --test-concurrency=1`: **131/131 passed**; no backend source was changed in this UI pass.
- `npm run check:routes`: **29 targets / 0 missing**.
- `npx expo install --check`: dependencies valid against the local SDK 57 bundled map; network metadata was unavailable.
- `npx expo export --platform web`, `--platform android`, and `--platform ios`: **all passed**. Temporary export folders were removed after validation.

### Still unverified

- No physical Android or iOS device run, native APK/IPA build, keyboard/IME behavior, accessibility-tree review, or rendered screenshot review was performed. Exports verify JS bundling only.
- Real Google sign-in still needs the Web, Android, and iOS OAuth client IDs in the local/EAS build environments plus Android signing SHA-1 registration. The code preserves the real Google flow and does not mock authentication.
- Promotion slides and available offers depend on active outlet-configured campaigns/coupons; popular/order-again rails depend on real paid-order history. Their empty states are intentional and do not use sample data.
