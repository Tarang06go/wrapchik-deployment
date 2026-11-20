# Wrapchik Full Project Audit

**Audit date:** 2026-11-20  
**Scope:** current repository source, configuration and available local runtime. No application source, credentials, database records, or dependencies were changed. This report is the only file created.

## 1. Executive summary

Wrapchik is a substantial Expo/React Native client with an Express/Mongoose backend. It contains most core food-ordering, admin, payment-review, and group-order code. Backend unit coverage is broad, dependencies resolve, and web and Android JavaScript exports succeed. Runtime checks also reached the current laptop backend and its product endpoint over the LAN.

It is not production-ready. A confirmed render-time crash prevents the group-cart route from rendering: `group` is read before its `useState` declaration. No full student, group, or admin journey was exercised with a real account. Google configuration is enabled on the backend, but OAuth was not completed with a real Google account and iOS build-time configuration is absent locally. No signed APK build, iOS build, or phone/keyboard test was performed. The installed APK shown earlier had password/OTP controls that are no longer in the current source, so it was not a reliable representation of this source tree.

### Headline estimates

- **Feature areas inventoried:** 58.
- **Verified at automated logic level:** 6; no complete customer/admin journey was verified end to end.
- **Partial:** 49.
- **Broken:** 1 (group-cart render).
- **Not implemented:** 2 (admin customer-management screen/API, admin-managed promotional banners).
- **Feature implementation estimate:** **about 53%**, using the explicit weighted estimate in section 11. This is not a claim that 53% of code is written.
- **Verified-working feature ratio:** **about 10% (6/58)** based on the narrow tested mechanisms listed here; full user-journey verification is **0/3**.
- **Production-readiness checkpoint ratio:** **about 30% (3/10 release gates)**, a heuristic gate count, not a prediction of uptime or quality.

## 2. Evidence and limits

Status labels mean:

- **VERIFIED WORKING:** the specified behavior passed an automated test or a direct runtime check. The table says which.
- **PARTIAL:** source or API exists, but an important integration, full workflow, provider, or device behavior is unverified.
- **BROKEN:** a concrete failure is evident in the current source or runtime.
- **NOT IMPLEMENTED:** no corresponding feature/API was found in the inspected repository.

Checks actually run:

| Check | Result | Evidence / limit |
|---|---|---|
| Backend automated suite | **PASS: 75/75** | `npm test` from `backend`. First run in the restricted environment had 74/75 because a localhost test server failed with `connect EACCES 127.0.0.1:14925`; rerun with localhost access passed all 75. |
| Frontend tests | **PASS: 7/7** | `node --test` from `frontend`; API URL validation, Google config, and UPI URI tests. |
| Dependency trees | **PASS** | `npm ls --depth=0` in each package showed no invalid/missing dependency. No install/upgrade was run. |
| Web export | **PASS** | `npx expo export --platform web`; 2,924 modules; temporary output at `%LOCALAPPDATA%\Temp\wrapchik-audit-web-export`; web JS bundle about 3.7 MB. |
| Android JS export | **PASS, JS only** | `npx expo export --platform android`; 3,626 modules; temporary Hermes bundle about 6.3 MB at `%LOCALAPPDATA%\Temp\wrapchik-audit-android-export`. This is not a Gradle build or APK test. |
| Expo config | **PASS** | `npx expo config --json` resolved SDK 57 and identifiers `com.wrapchik.app` for Android and iOS. |
| Expo Doctor | **NOT RUN** | `expo-doctor` is not locally installed. It was not fetched because dependency installation was prohibited. |
| Backend live API | **PASS, laptop only** | Existing process PID 16052 owned port 5000. `GET /` and `GET /api/products` returned HTTP 200 via the laptop LAN address. Google config endpoint returned `enabled=true`, `domain=thapar.edu`. |
| Socket.IO transport | **PARTIAL** | Unauthenticated polling handshake returned HTTP 200. No authenticated socket session or emitted order/group event was tested. |
| Expo Go Metro | **PARTIAL** | Expo Go Metro was started on port 8082 with `--go --host lan`; LAN `/status` returned HTTP 200. Physical handset load was not observed. A different server on 8081 was in `--dev-client` mode. |
| Physical Android / ADB | **NOT TESTED** | ADB is unavailable on PATH and there was no device connection available to this audit. No keyboard, touch, navigation, or APK runtime claim is made. |
| iOS build/device | **NOT TESTED** | The audit host is Windows; no EAS iOS build or Apple device test was run. |
| Production backend / payment / OTP delivery | **NOT TESTED** | No production deployment, real email inbox, real provider payment, or production data was used. |

## 3. Architecture and configuration

- **Frontend:** React Native 0.86.3, React 19.2.3, Expo SDK `~57.0.33`, Expo Router `~57.0.31`. JavaScript/JSX with Context providers and feature services. Google native sign-in uses `react-native-nitro-google-signin` 2.3.1 and Nitro modules.
- **Backend:** Node.js (audit host Node v24.14.0), Express 4.22.3, Socket.IO 4.8.3, Mongoose 8.24.10. The backend binds to `0.0.0.0` and port 5000 by default.
- **Database:** MongoDB via Mongoose; models include User, Product, Category, Order, Payment, GroupOrder, Coupon, PickupSlot, Table, RestaurantSettings, Notification, Issue, OTP challenges, Google challenges, and WebhookEvent. Local `MONGO_URI` points at loopback. The live server reported a successful MongoDB connection; no migration or database inspection was performed.
- **Authentication:** HS256 JWT, password hashing with bcrypt/bcryptjs, verified-email/legacy-phone checks, role middleware, rate limits, and Google ID-token validation. Google backend config is enabled in the current running server; this does not prove a real OAuth login.
- **Image storage:** Cloudinary package/configuration is present; actual upload was not tested.
- **Payments:** New checkout is built around server-generated UPI instructions and cash-at-counter; payment remains pending until an administrator records verification. Razorpay/Cashfree endpoints and models remain for historical/legacy handling; the current checkout does not prove live gateway payment.
- **Real time:** Socket.IO is JWT-gated; clients join their personal room and administrators join admin/kitchen rooms. Transport handshake passed; authorized event workflows remain unverified.
- **Build/deployment:** `frontend/eas.json` has development, preview, and production profiles. Preview/production require HTTPS API URLs through the pre-install validator. Static Android and iOS identifiers are both `com.wrapchik.app`.
- **Current development networking:** local `frontend/.env` targets a private LAN HTTP API on port 5000. That is suitable only for local development on a reachable network; the preview/production validator requires HTTPS. EAS environments are external and were not queried.
- **Secret handling:** root `.gitignore` and `frontend/.easignore` exclude `.env` files while allowing `.env.example`. Example files contain blank/placeholder values. A targeted source scan for common Google/provider live keys and private-key headers found no matches; no secret values were printed. A full history-aware secret scan was unavailable because project-root Git metadata and a dedicated secret scanner were unavailable.
- **CORS:** development defaults to permissive origin handling. Production requires explicit origins; when `CORS_ORIGIN` is absent in production, browser CORS is disabled. A deployed web client therefore needs a correct explicit origin list.

## 4. API inventory

Routes are mounted in `backend/src/server.js`:

| Prefix | Implemented surface |
|---|---|
| `/api/auth` | Password login/register, OTP send/verify/reset, Google config/challenge/login, profile, favourites. |
| `/api/products`, `/api/categories` | Catalogue reads and admin CRUD/availability. |
| `/api/orders` | Create, customer history/details/cancel/reorder. |
| `/api/payment` | Legacy Razorpay/Cashfree operations, UPI instructions/reference submission/review, cash confirmation. |
| `/api/groups` | Create/join/details, member and item operations, shared allocations, quote/checkout, contribution payment and admin review/reconciliation. |
| `/api/admin` | Protected order list/state updates, analytics, support issue queue/resolution. |
| `/api/coupons`, `/api/pickup-slots`, `/api/settings`, `/api/tables` | Customer/admin coupon, schedule/fulfilment settings and table operations. |
| `/api/notifications`, `/api/issues` | Customer notifications and support issue APIs. |

Most admin route groups apply `protect` and `adminOnly`. Group contribution review/reconciliation routes do likewise. The route definitions prove registration of middleware, not a live authorization test for every endpoint.

## 5. Feature inventory

Frontend means a screen or service exists; “hidden” means route/API may exist but no normal primary navigation entry was found. Tests are unit/controller tests unless marked runtime. **A passing backend test does not prove the mobile UI-to-backend journey.**

| # | Feature | Status | Frontend | Backend | Tested / missing work |
|---:|---|---|---|---|---|
| 1 | Google Sign-In | 🟡 PARTIAL | Google button and native/web flows; separate admin mode retained. | Config, challenge, token validation, link/create endpoints. | Config endpoint enabled; controller unit test passes. No real account chooser/token/session test; EAS and device config incomplete. |
| 2 | Student registration | 🟡 PARTIAL | Signup/verification routes; login screen offers Google-only student entry. | OTP registration and Google-created student account. | Unit tests cover some controller cases; real enrollment/delivery not tested. Signup is not linked from the current login screen. |
| 3 | Admin password login | ✅ VERIFIED WORKING | Separate password form. | Login endpoint and admin role. | Compatibility test passed; no live browser/admin workflow. |
| 4 | Student email/password login | 🟡 PARTIAL | Not offered on current student login screen. | Legacy/backend password login remains. | Compatibility tests cover backend; customer-facing access is hidden by design. |
| 5 | Email verification / OTP | 🟡 PARTIAL | OTP and email verification screens. | Rate-limited OTP challenges and verification. | Automated security tests pass; real @thapar.edu inbox delivery not tested. |
| 6 | Session persistence/restoration | 🟡 PARTIAL | Auth context and token store. | JWT-backed `/me`. | Code-level storage handling; device persistence/restoration not tested. |
| 7 | Forgot password | 🟡 PARTIAL | Forgot-password screen. | OTP reset routes. | Automated OTP tests; no real email/reset journey. |
| 8 | Logout | 🟡 PARTIAL | Profile/auth actions. | JWT stateless; no server logout required. | Code exists; session clearing on device not exercised. |
| 9 | Role-based access | ✅ VERIFIED WORKING | Admin layouts and separate route group. | `protect` and `adminOnly`. | Tests verify unverified users and students are denied admin access. |
| 10 | Splash/onboarding | 🟡 PARTIAL | Splash and onboarding routes/assets. | None needed. | Source/export only; cold start and skip/return paths untested. |
| 11 | Home/catalog | 🟡 PARTIAL | Home/search/menu screen. | Product/category/settings endpoints. | Live `GET /api/products` HTTP 200; full screen/data states not device-tested. |
| 12 | Categories/search/filter/sort | 🟡 PARTIAL | Search, category, diet, sort controls. | Catalogue query support. | Source/export only; combinations and empty results not tested. |
| 13 | Unavailable-product handling | 🟡 PARTIAL | Availability state/filtering present. | Product availability flag and admin update. | No live unavailable-item checkout test. |
| 14 | Product details/customization | 🟡 PARTIAL | Product detail/customization UI. | Product pricing/customization data. | Not exercised end to end. |
| 15 | Cart quantity/remove/persistence | 🟡 PARTIAL | Cart context and tab. | Server validates at checkout. | UI journey not tested. `CartContext` AsyncStorage get/set/remove operations are not time-bounded. |
| 16 | Checkout details/validation | 🟡 PARTIAL | Checkout form, pickup/order types. | Order validation. | Unit logic exists; invalid and successful UI submissions not tested. |
| 17 | Server pricing/order snapshot | ✅ VERIFIED WORKING | Sends product IDs/options/quantities. | Recalculates price and stores order snapshots. | Automated order tests verify server totals and pending payment; no customer E2E. |
| 18 | Coupons/promotions | ✅ VERIFIED WORKING | Coupon entry/quote UI. | Coupon eligibility, reservation/release/redemption. | Backend unit tests pass for limits, discounts, and reservations; full order journey untested. |
| 19 | Scheduled pickup | 🟡 PARTIAL | Pickup mode/slot UI. | Pickup-slot model/routes and India-time validation. | Unit tests cover slot rules; actual booking unavailable/unverified at runtime. |
| 20 | UPI QR/reference payment | 🟡 PARTIAL | Payment screen, UPI URI/QR and transaction-reference submission. | Per-order instructions and pending/manual-review records. | URI and payment safety tests pass; real UPI transaction not made and payment remains manual. |
| 21 | Cash at counter | ✅ VERIFIED WORKING | Checkout payment option. | Admin-only cash confirmation. | Unit test proves payment is only confirmed via admin confirmation; no counter flow exercised. |
| 22 | Order confirmation | 🟡 PARTIAL | Confirmation screen/route. | Order create/detail APIs. | Not reached from a live customer order. |
| 23 | Live tracking/cancel | 🟡 PARTIAL | Tracking screen and cancel action. | State machine, order query/cancel and Socket.IO events. | No authenticated tracking event journey. |
| 24 | Order history/reorder | 🟡 PARTIAL | Orders screen and reorder action. | Customer-owned order/history routes. | Not exercised with account data. |
| 25 | Favourites | 🟡 PARTIAL | Favourites screen/actions. | Protected add/remove/list endpoints. | No live account flow. |
| 26 | Notifications | 🟡 PARTIAL | Notifications screen, deep-link bridge and Expo token registration. | Notification routes and push service. | No device push delivery or tap navigation test. |
| 27 | Profile | 🟡 PARTIAL | Profile screen/edit/logout. | Protected profile endpoint. | No real profile update test. |
| 28 | Support/issues | 🟡 PARTIAL | Support/report issue screens. | Protected create/list and admin resolution APIs. | No submitted issue or admin resolution tested. |
| 29 | Group creation | 🟡 PARTIAL | Group-order screen. | Protected group creation. | Not live-tested; no home/tab entry was found, so discoverability is poor. |
| 30 | Join/invite friends | 🟡 PARTIAL | Join-by-code/share path. | Protected join and membership. | No invite/deep-link flow tested. |
| 31 | Live group updates | 🟡 PARTIAL | Socket listener/refresh logic. | Authenticated group event broadcasts. | Only generic unauthenticated transport handshake tested. |
| 32 | Shared dishes/allocations | 🟡 PARTIAL | Share/accept UI. | Item allocations and accepted revisions. | Unit tests cover allocation rules; multi-user flow not tested. |
| 33 | Split contributions | 🟡 PARTIAL | Split checkout/contribution UI. | Per-member amount and contribution records. | Pricing/schema tests pass; no live contribution. |
| 34 | Host pays | 🟡 PARTIAL | Checkout mode selector. | Single payer order and informational member shares. | Not exercised end to end. |
| 35 | Group payment verification/reconciliation | 🟡 PARTIAL | Admin contribution queue/actions. | Protected review and reconcile endpoints. | Source/unit tests only; no admin data flow. |
| 36 | Group-cart route | 🔴 BROKEN | `frontend/app/group-cart/[id].jsx`. | Supporting group APIs exist. | **Confirmed crash:** line 24 evaluates `group?.leaderId` before line 25 declares `const [group, setGroup]`. JavaScript temporal dead zone causes `Cannot access 'group' before initialization`; route cannot render. |
| 37 | Admin dashboard/analytics | 🟡 PARTIAL | Dashboard, analytics. | Admin-protected analytics. | No live admin session/dashboard run. |
| 38 | Admin order desk/state machine | 🟡 PARTIAL | Orders screen/actions. | Protected order listing and validated state transitions. | Backend tests cover safeguards; no full accept→prepare→ready→complete admin workflow. |
| 39 | Product CRUD | 🟡 PARTIAL | Admin products screen. | Admin product routes. | No live create/edit/delete exercise. |
| 40 | Category CRUD | 🟡 PARTIAL | Admin categories screen. | Admin category routes. | No live create/edit/delete exercise. |
| 41 | Product availability | 🟡 PARTIAL | Toggle in admin products. | Admin availability endpoint. | Code exists; student visibility transition not tested. |
| 42 | UPI/cash admin verification | ✅ VERIFIED WORKING | Review queue/actions. | Admin-only review, audit fields, cash confirmation. | Backend unit tests pass; no actual money/real admin flow. |
| 43 | Group contribution administration | 🟡 PARTIAL | Group review UI. | Admin-only review/reconciliation. | No live workflow. |
| 44 | Admin coupon management | 🟡 PARTIAL | Coupons screen. | Protected coupon CRUD. | No admin browser/device run. |
| 45 | Tables | 🟡 PARTIAL | Admin tables screen and checkout selector. | Table routes/model. | No live reservation/order test. |
| 46 | Fulfilment/scheduling settings | 🟡 PARTIAL | Admin settings/scheduling controls. | Settings and pickup-slot endpoints. | Unit rule tests only. |
| 47 | Admin issue queue | 🟡 PARTIAL | Admin issues screen. | Admin-protected issue list/resolve. | No live support-ticket test. |
| 48 | Quantity-based inventory | 🟡 PARTIAL | Product availability management only. | Product has `available`, but no stock count/decrement model was found. | Implement actual stock quantities/reservation and out-of-stock enforcement if this requirement remains. |
| 49 | Admin customer management | ⚪ NOT IMPLEMENTED | No customer-management screen found. | No admin customer-management route found. | Define permitted admin actions/privacy scope, then implement and test. |
| 50 | Admin-managed promotional banners | ⚪ NOT IMPLEMENTED | No banner-management UI found. | No banner model/API found. | Either remove this promise or implement settings/model and customer display. |
| 51 | Android native APK | 🟡 PARTIAL | Expo/Router configuration, native module dependencies and EAS APK profiles. | N/A. | Android JS export passes; no Gradle/EAS APK build or install was performed. ADB unavailable. |
| 52 | iOS app | 🟡 PARTIAL | Expo config, iOS identifier, native dependencies. | N/A. | Config resolves; no macOS/Xcode/EAS iOS build/device verification. iOS Google ID absent locally. |
| 53 | Web app | 🟡 PARTIAL | Expo web routes compile. | Live API works on laptop LAN. | Web production export succeeded. No browser screen-by-screen or production-origin test. |
| 54 | Android keyboard/touch | 🟡 PARTIAL | Native `Input` components and keyboard diagnostics. | N/A. | Prior device reports conflict; no current ADB/physical test, so keyboard is not verified. |
| 55 | Navigation/routing | 🟡 PARTIAL | Expo Router route tree exports. Group route is registered. | N/A. | Export validates bundle; physical navigation not tested; group route crashes and group entry is not linked from primary tabs/home. |
| 56 | Mobile API connectivity | 🟡 PARTIAL | Current local endpoint targets the laptop LAN host over HTTP. | Backend is bound to `0.0.0.0`; health and products returned HTTP 200 via laptop LAN. | No phone request observed. Preview/production builds require HTTPS and matching EAS environment config. |
| 57 | Socket.IO live workflow | 🟡 PARTIAL | Socket context reconnects and authenticates with JWT. | JWT middleware, personal/admin/kitchen rooms. | Polling handshake HTTP 200 only; no authorized event update verified. |
| 58 | Responsive layout/safe areas/accessibility | 🟡 PARTIAL | Shared styles, ScrollViews, safe-area dependencies and responsive home sizing. | N/A. | Static source review only; no device-size, screen reader, contrast, or overflow audit. |

### Inventory totals

| Status | Count |
|---|---:|
| ✅ Verified (specific automated behavior; not full journeys) | 6 |
| 🟡 Partial / not fully verified | 49 |
| 🔴 Broken | 1 |
| ⚪ Not implemented | 2 |
| **Total** | **58** |

## 6. Critical bugs and technical issues

1. **Group cart throws before render.** In `frontend/app/group-cart/[id].jsx`, `isLeader` reads `group` at line 24 before the state declaration at line 25. This is a confirmed JavaScript temporal-dead-zone error and blocks the group workflow as soon as this screen mounts.
2. **Group ordering is not discoverable.** The route is registered, but no primary Home/tab link to `/group-order` was found. This is a visibility issue separate from the render crash.
3. **Cart storage operations are not bounded.** `frontend/context/CartContext.jsx` directly awaits/uses AsyncStorage `getItem`, `setItem`, and `removeItem` without timeouts. A stalled native storage operation can leave cart hydration or clearing pending.
4. **No current Android device evidence.** ADB is not installed/on PATH. The previous keyboard report cannot be closed from source/export checks alone.
5. **Expo Go vs development-client confusion.** Port 8081 was served with `--dev-client`; a separate Expo Go server on 8082 was started and its LAN `/status` returned 200. A handset still needs to scan the 8082 QR while on the same Wi-Fi. Expo Go does not include the native Google-sign-in module; Google native sign-in requires a development/standalone build.
6. **Local and release API environments differ.** The local frontend env points at a private LAN HTTP endpoint. `frontend/scripts/validate-api-url.cjs` rejects HTTP for preview/production; those builds require a reachable HTTPS backend URL configured in their EAS environment. The phone was not tested against either target.
7. **Google OAuth remains partly unverified.** The running backend reports Google enabled and `thapar.edu`; server code validates audience, nonce, hosted domain, email verification and account role. No actual token/account flow was tested. The iOS client ID is missing from local frontend env; remote EAS values and Android signing SHA-1 registrations were not inspected.
8. **Production web CORS can be misconfigured.** Production backend disables CORS if `CORS_ORIGIN` is missing. Set explicit deployed web origins and test them before release.
9. **No live email, push, or provider payment proof.** OTP tests use controlled/unit setups; no student inbox was checked. Push registrations/provider delivery were not tested. Current new checkout relies on manual UPI/cash verification; Razorpay credentials were absent from the local startup log and gateway code is legacy for old orders.
10. **Android APK failure remains unverified for the currently installed artifact.** Earlier screenshot showed an older password/OTP screen, whereas current source is Google-only for students. No APK was available in Downloads/workspace during this audit, so its embedded API URL, signing, and source revision could not be inspected.
11. **No complete end-to-end workflow passed.** Backend unit tests establish important rules, but no real customer/admin session was used to traverse the UI and API together.

## 7. User-journey results

| Journey | Last verified step | First broken/unverified step | Reason / files |
|---|---|---|---|
| Student: launch → sign-in → home → browse → cart → checkout → payment → tracking | Public Google config endpoint is enabled; API/catalog reads return 200 from the laptop. | Real Google chooser/token/challenge/login and home redirect are unverified; downstream order flow has no live account test. | `frontend/components/auth/GoogleSignInButton.jsx`, `frontend/app/(auth)/login.jsx`, `backend/src/controllers/googleAuthController.js`, `frontend/services/api.js`. Google E2E requires actual OAuth/device credentials. |
| Group: create → invite/join → items → split/host payment → admin review → tracking | Unit tests cover group pricing/schema/allocation rules. | No live multi-user first step verified; if group checkout navigates to its cart, that route crashes before render. | `frontend/app/group-order.jsx`, `frontend/app/group-cart/[id].jsx:24-25`, group controllers/services. |
| Admin: login → dashboard → order lifecycle/payment review | Password login/RBAC and payment safeguards pass controller/unit tests. | Live admin dashboard and actual order list/state workflow unverified. | `frontend/app/admin/*`, `backend/src/routes/adminRoutes.js`, `backend/src/controllers/adminController.js`. No test account session used. |

No real payments or production-data mutations were performed.

## 8. UI/UX review (source-level, not a rendered audit)

These scores are provisional source-level judgments. The old installed-APK screenshot is not evidence of the current source appearance; current screens were not visually inspected on a device.

| Area | Score / 10 | Evidence and limitation |
|---|---:|---|
| Branding / visual consistency | 6 | Wrapchik-specific theme and reusable components exist; current-source full-screen visual review was not performed. |
| Mobile friendliness / responsive layout | 6 | Scrollable forms and width-aware home layout exist; actual devices/sizes untested. |
| Navigation / discoverability | 5 | Expo routes compile; group ordering is not exposed from primary navigation and group-cart crashes. |
| Browse/order UX | 6 | Search, customization, cart, coupon, scheduling and checkout surfaces exist; full flow untested. |
| Checkout/payment experience | 5 | Server-priced UPI/cash flow is cautious; real money/provider and cancel/failure flows untested. |
| Group-order experience | 2 | Broad feature code exists, but the cart route has a confirmed render crash and route discoverability is low. |
| Admin operations | 6 | Dashboard/order/menu/settings/issues screens and protected APIs exist; no live admin journey or visual review. |
| Loading/error/recovery | 5 | Inline loading/error/retry patterns exist in screens; not all requests are time-bounded (notably cart storage). |
| Accessibility | 4 | Some accessibility roles/labels exist; no screen-reader, contrast, focus-order or touch-target audit. |

## 9. Security review

- **Positive evidence:** JWT verification pins HS256; user password hashes are excluded from protected response selection; login/OTP/Google routes have rate limits; OTP and Google challenges use expiring records; Google validates audience, nonce, verified email and `hd=thapar.edu`; admin routes apply role middleware; socket handshakes require JWT and reload the user role; manual payment review records admin action; orders are priced from server data.
- **Environment handling:** `.gitignore` and `.easignore` exclude `.env`/`.env.*`, retaining `.env.example`. No secret values are included in this report. Git history and a complete secret-scanner pass could not be checked because project-root Git metadata/secret scanner were unavailable.
- **Release configuration risk:** production CORS requires explicit `CORS_ORIGIN`; EAS production/preview must receive HTTPS `EXPO_PUBLIC_API_URL`; Google native IDs/signing fingerprints still require real provider-side setup. These values should be configured in deployment/EAS secrets or public build variables as appropriate, not source code.
- **Scaling caveat:** express-rate-limit uses its default in-process store in the inspected route definitions; multi-instance deployment should use a shared rate-limit store or document one-instance deployment.
- **Payments:** app redirects/UPI QR do not constitute proof of payment. Current backend tests enforce pending/manual-review behavior; do not transition an order to paid from client callbacks.
- **Not proven:** production TLS/security headers, deployed CORS policy, secret-history scan, Google account link conflicts on real data, webhook provider signatures against real events, and multi-instance authorization/limits.

## 10. Platform readiness

- **Web:** bundle export passes. Runtime endpoint is available from the laptop. A browser-level screen sweep, production CORS, and deployed domain were not verified.
- **Android:** Expo config and JS bundle export pass; native APK/Gradle/EAS build was not run. ADB unavailable. Expo Go Metro at `exp://172.16.73.217:8082` responds on LAN, but the device has not been seen loading it. Native Google sign-in is unavailable in Expo Go and requires a custom development/release build.
- **iOS:** app identifier and Expo config exist; no Xcode/EAS iOS build or Apple device test. iOS Google client configuration is not present locally.
- **Expo compatibility:** package versions are internally installed and `npm ls` is clean. No Expo Doctor result; SDK is 57. No dependency upgrade was attempted.
- **Keyboard and native dialogs:** source supports native TextInputs and platform dialogs, but no real-device keyboard, scrolling, focus, chooser, or modal behavior is verified.

## 11. Completion estimates and calculation

Feature count is the 58-row inventory above.

- **Weighted feature implementation estimate: 53%.** Formula: verified row = 1 point; partial row = 0.5; broken-but-present row = 0.2; not implemented = 0. Total `(6 + 49×0.5 + 1×0.2) / 58 = 52.9%`. Weights are an explicitly approximate rubric; the count table is the more reliable result.
- **Automated-mechanism verification: 10%.** `6 / 58 = 10.3%` rows have a passing focused test or build/export check; this does not mean only 6 tests passed. Complete E2E user flows verified: `0 / 3 = 0%`.
- **Production readiness: 30% release-gate ratio.** Three of ten gates pass: dependency-tree health, automated suites, and platform JS exports. Local API availability is verified, but not a production deployment. The remaining gates are HTTPS release configuration, full Google login, signed Android device test, iOS build/device, real email/push/payment integrations, and production security/CORS review. This is a planning heuristic, not a probability.

## 12. Prioritized remaining work

Complexity: S small, M medium, L large. “Root cause” is stated only when confirmed.

### P0 — Crashes, sign-in, mobile/API

| Task | Problem / confirmed root | Files | Required work / dependency | Complexity | Verification criteria |
|---|---|---|---|---|---|
| Fix group-cart initialization | Confirmed TDZ read of `group` before declaration. | `frontend/app/group-cart/[id].jsx` | Move leader derivation below state or derive after state. | S | Route mounts, initial loading completes, leader/member controls render; add a regression test. |
| Verify phone Metro/API path | Expo Go vs dev-client QR mismatch observed; handset not tested. | `frontend/.env`, `frontend/services/apiEndpoint.js`, Expo startup | Scan Expo Go QR at `exp://172.16.73.217:8082`; ensure phone/laptop same Wi-Fi. Use deployed HTTPS URL for preview APK. | S | Phone fetches `/` and products; repeat reload/offline recovery. |
| Verify Android keyboard | Historical device report; root not proven on current APK. | `frontend/components/common/Input.jsx`, auth screens | Install current native development build; inspect ADB focus/IME logs. | M | Email/phone/password fields focus, keyboard appears, typing/scroll/repeated navigation work on OnePlus Nord 4. |
| Bound cart storage | AsyncStorage get/set/remove have no operation timeout. | `frontend/context/CartContext.jsx` | Add bounded/recoverable storage operations without blocking UI. | S/M | Inject stalled/rejected storage; cart screen still navigates and recovers. |
| Finish Google device configuration | Backend enabled, but real OAuth not verified; iOS ID missing locally, EAS signing config unknown. | `frontend/app.config.js`, EAS env, Google Cloud, backend env | Register Web/Android/iOS OAuth clients, exact package/bundle IDs and signing SHA-1; set runtime/build variables. | M | Real Android/iOS account picker; allowed Thapar account creates/retrieves student; admin remains on password; wrong domain rejected. |

### P1 — Core orders, payments, admin

| Task | Problem / root | Files | Required work / dependency | Complexity | Verification criteria |
|---|---|---|---|---|---|
| Run customer journey | No customer E2E flow has been performed. | auth, home, product, cart, checkout, payment, tracking screens/services | Use real authorized test account and catalogue; no fake successful payment. | L | Browse→customize→cart→coupon/schedule→order→pending payment→tracking/history with API evidence. |
| Run admin lifecycle | Only automated backend logic checked. | admin screens/controllers | Use admin account; test accept/reject/prepare/ready/complete and manual payment review. | L | Role-denied student requests and authorized state/payment transitions verified. |
| Configure release API/CORS | Local URL is LAN HTTP; release validator requires HTTPS; production CORS requires explicit origins. | EAS environments, `frontend/scripts/validate-api-url.cjs`, backend deploy config | Deploy reachable HTTPS API; set EAS `preview`/`production` URL and production `CORS_ORIGIN`. | M/L | EAS validator passes and phone/browser reaches API, Socket.IO and routes over TLS. |
| Verify OTP delivery | No real inbox delivery was tested. | backend mail config/controllers | Configure sender and run real @thapar.edu signup/reset, preserving rate/expiry controls. | M | Inbox receives code; expiry, resend and attempts checked. |
| Complete payment reconciliation | Razorpay/Cashfree remain legacy; new checkout is manual UPI/cash. | checkout/payment screens, payment controllers, admin orders | Decide official provider vs manual-only scope; configure sandbox only if enabling gateway. | L | Failure, cancel, replay, signature and manual verify behavior; no client-created success. |

### P2 — Groups and advanced functionality

| Task | Problem | Files | Required work / dependency | Complexity | Verification criteria |
|---|---|---|---|---|---|
| Repair and expose group ordering | Route crashes and is absent from primary navigation. | group cart, home/profile/nav | Fix TDZ; add visible entry; run two authenticated members. | M | Create/share/join/add/edit/lock/checkout and realtime refresh. |
| Verify split and host-pay | Logic and tests exist; no live multi-user group payment. | group checkout controllers/screens, admin/orders | Validate pricing, contribution ownership, pending state and reconciliation against test records. | L | Member and host modes reconcile exact server-calculated total. |
| Implement quantity inventory | Current product model has only `available`, not quantities. | Product model/controllers/admin products/orders | Define stock policy; reserve/decrement atomically and restore on cancellation if required. | L | Concurrent orders cannot oversell; out-of-stock product blocked server-side. |
| Close missing admin capabilities | No customer admin or banner admin/API. | new routes/models/screens | Confirm product scope/privacy and implement or remove commitments from docs. | M/L | Protected CRUD/read behaviors and customer display tested. |

### P3 — UI/UX, visibility and mobile polish

| Task | Problem | Files | Required work | Complexity | Verification criteria |
|---|---|---|---|---|---|
| Rendered screen review | Current audit was source/runtime check, not visual inspection. | customer/admin routes and shared components | Review screenshots across phone/tablet/web; correct overflow, image crop, spacing, empty/error states. | M | Capture actual current-build screens and test navigation/scroll. |
| Accessibility review | No assistive-technology audit. | shared buttons/inputs/screens | Verify labels, focus order, touch targets, contrast and error announcements. | M | TalkBack/browser screen-reader checks and contrast/size review. |
| Remove dead/hidden sign-in paths or clarify support | Student password and OTP endpoints/routes remain but primary login is Google-only; signup route lacks link there. | auth screens/routes/docs | Decide whether legacy flows remain supported; make navigation/docs consistent without removing existing accounts. | S/M | Direct route and expected user-access behavior agree with docs. |

### P4 — Release hardening and deployment

| Task | Problem | Files/config | Required work / dependency | Complexity | Verification criteria |
|---|---|---|---|---|---|
| Signed Android release verification | JS export is not APK validation; no device/ADB. | EAS Android profiles/native package | Build signed preview after HTTPS env setup; install and exercise current source. | M | APK starts offline gracefully and performs auth/order flows with logs clean. |
| iOS release verification | No iOS build; local OAuth client absent. | EAS iOS profile/app config | Configure iOS OAuth scheme and signing; build through macOS/EAS. | L | Install on iPhone, exercise auth, keyboard, payments and deep links. |
| Production monitoring/recovery | Deployment/health monitoring not proven. | DEPLOYMENT.md/server | Configure HTTPS, DB backups, logs/alerts, explicit CORS and rate-limit store. | L | Restore/health test, auth limits, webhook idempotency and outage recovery. |
| Notification delivery proof | Expo ticket/push registration is not confirmed receipt. | notification service/EAS | Configure provider credentials and test device/token lifecycle. | M | Foreground, background, cold start and tap-to-order navigation tested. |

## 13. Recommended development sequence for Claude

1. Fix the one-line group-cart render crash and add a regression test before changing group UI.
2. Verify the current source on a physical Android device with Expo Go for JS-only screens, then use a development build for native Google sign-in and keyboard checks.
3. Keep the local LAN API target for local development only; configure HTTPS API/CORS per EAS release environment.
4. Complete real Google OAuth setup, then test one Thapar student and one administrator path without changing existing account roles.
5. Test customer and admin end-to-end workflows against a non-production account/catalogue; keep UPI/cash pending until verified.
6. Bound cart storage, then prove session/cart recovery under stalled storage and network failures.
7. Decide inventory, banners, and customer-management scope; implement only approved features.
8. Perform UI/accessibility review from current Android/web screenshots, then build and test signed Android and iOS artifacts.

## 14. Summary for handoff

**Strengths:** modern three-tier stack; API route coverage is broad; source keeps pricing and order snapshots server-authoritative; auth/RBAC/payment protections have meaningful automated coverage; dependency trees are clean; web and Android JS exports succeed; local LAN backend and catalog reads work.

**Do not claim yet:** Google login works for a real account; keyboard works on the OnePlus; Android APK is current or buildable; iOS is compatible at runtime; push/email/gateway delivery works; group ordering works; complete ordering/admin workflows pass; app is production-ready.

**First blockers:** fix `group` initialization; run current code on device; complete Google provider/signing configuration; set reachable HTTPS EAS API/CORS; bound cart storage; complete real customer/admin integration tests.

## 15. Post-audit implementation update — 2026-11-20

This update supersedes conflicting implementation-status statements above while preserving the original audit snapshot.

- **P0 updates:** the group-cart temporal-dead-zone defect is fixed and Share a Meal is linked from Home/Profile; bounded storage, route checks, and network recovery remain in the current source. Group socket updates now reach only currently joined members. Device keyboard and two-user socket behavior are still not verified.
- **P1 updates:** quantity inventory is additive (`stock: null` remains unlimited) and atomically reserved/restored for new orders. A read-only, explicit-URI menu audit command exists but was not run against a supplied read-only DB/reference. Protected customer insights include verified order aggregates and audited student disable/enable. Admins can configure one optional in-app promotion banner; it is disabled by default and does not touch prices/payments.
- **P2 updates:** pickup QR uses a 30-minute HMAC-SHA256 token, stores only a digest, and the protected admin endpoint consumes it atomically for a paid READY takeaway. Co-purchase and “Because you ordered” recommendations use verified completed orders with availability checks and a 30-second cache. Existing group split/Host Pays, scheduling, manual payment verification, notifications and order tracking remain present. Physical QR scan, two-user group workflow, push and real-time device delivery were not tested. Loyalty redemption is not implemented because no earning/redemption/expiry policy exists in the source or project brief.
- **Verification on this update:** backend `npm test` **94/94**, frontend `node --test` **12/12**, `npm run check:routes` **20 targets / 0 missing**, `npx expo install --check` passes against the bundled SDK map (network lookup unavailable), `npm ls --depth=0` clean, web export and Android JavaScript export succeed. Live read-only `GET /health`, `/`, `/api/products`, `/api/settings`, and the product-pair endpoint returned expected responses; MongoDB reported connected. No order/payment/customer mutation was performed.
- **Still not verified:** real Google account/OAuth, OTP inbox delivery, Android/iOS install or keyboard, native QR camera/deep link, authorized customer/admin journeys, real push receipt, live payment, EAS build, production deployment, and visual screenshots. Android/web exports are JavaScript bundles, not APK/native builds.
- **Remaining scope:** loyalty policy and redemption, student/time-window offer rules, meal planning/reminders, directions/streaks, complete rendered UI/accessibility review, CI, deployment/backup rehearsal and signed Android/iOS release checks.

## 16. Follow-up implementation update — 2026-11-20

This note supersedes conflicting status statements in the original audit and the earlier implementation addendum. Historical counts and observations above are retained as snapshots.

- The group-cart initialization defect is fixed. Expired OPEN group sessions now expire through a bounded, idempotent server sweep; invitation, split, Host Pays, and contribution workflows remain subject to two-account runtime verification.
- Admin kitchen operations now return active orders oldest-first, highlight orders beyond an outlet-configurable overdue threshold, and require a reason before rejection. New-order alerts include visual notification, plus best-effort web sound/native haptics.
- Store settings now support up to five scheduled promotion campaigns with fixed internal CTA routes and optional Cloudinary HTTPS images. Uploading images to Cloudinary is still a manual step because no Cloudinary upload credentials/endpoint are configured in this repository.
- Checkout includes directions to the outlet. Product/admin touch targets are at least 48dp/pt. A responsive screenshot checklist was added, but screenshots and accessibility/device behavior are not verified.
- P1/P2 business logic remains server-authoritative for pricing, snapshots, inventory, coupon/reward quotes, payment status and order transitions. No live payment/order was created.
- New focused tests bring the backend suite to **126/126** and frontend suite to **20/20**. Route check reports **22/22 targets present**; web and Android JavaScript exports passed. A native APK build, phone testing, and rendered visual review are not claimed complete.
- Read-only query-index checks report **0 missing query indexes**. The corrected loyalty/review index planner reports **0 missing feature indexes**, and duplicate preflights are clean. No indexes or documents were changed. EAS account lookup failed because `api.expo.dev` could not resolve. Google OAuth, OTP/push delivery, production API, and provider/payment credentials remain external blockers.
