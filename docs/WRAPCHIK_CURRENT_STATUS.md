# Wrapchik Current Status Audit

**Audit date:** 2026-11-19  
**Scope:** Read-only inspection of current workspace source, local configuration presence, tests, exports, API reachability, and MongoDB indexes. No application source, environment file, account, or database record was changed. This report is the only project file created for this request.

## 1. Executive summary

Wrapchik has a substantial React Native/Expo frontend and Express/MongoDB backend, including authenticated ordering, manual UPI/counter payment, admin operations, group-order APIs, and automated business-rule tests. It is **not ready for a reliable live demonstration**: the group-cart route crashes at render time, normal navigation has no group-order entry, the API on port 5000 is unreachable from this session, and EAS preview has no API URL configured.

The supplied runtime error is confirmed in current source. A narrow same-function lexical-use-before-declaration scan found this single candidate in the scanned frontend source. Successful Expo export does not execute screen components and therefore does not disprove the runtime crash.

**Feature count:** 47 areas inspected: **0 fully working end-to-end verified, 43 partially implemented or runtime-unverified, 2 broken, 2 not implemented.** “Partially implemented” includes features with passing unit tests whose full screen/API journey was not verified.

**Estimated completion:** about **60% implementation completeness**. This is an engineering estimate, not a test score. Runtime and production readiness are materially lower.

## 2. Current architecture

### Frontend

- React Native **0.86.3**, React **19.2.3**, Expo SDK **57.0.33**, Expo Router **57.0.31**, React Native Web **0.21.2**.
- Expo Router file-based screens; React Context providers for authentication, cart, notifications, and Socket.IO.
- Axios API client with a 10-second default timeout, bearer-token interceptor, and timeout/configuration errors.
- Native session tokens use Expo SecureStore; web uses AsyncStorage. Auth storage operations have 4-second bounds. Cart AsyncStorage operations are not bounded.
- Socket.IO client **4.8.3**, Expo Notifications, native Google sign-in package, and UPI/QR utilities.
- The API-base variable is **EXPO_PUBLIC_API_URL**. Without it, web development falls back to browser hostname port 5000. Native phone startup uses the Expo LAN host or the provided helper script.

### Backend and API

- Node.js / Express **4.22.3**, Mongoose **8.24.10**, MongoDB, JWT HS256, bcrypt/bcryptjs, Helmet, express-rate-limit, express-validator, Nodemailer/Resend, and Socket.IO.
- REST routes are mounted under **/api**: auth, categories, products, orders, payment, admin, tables, settings, groups, pickup slots, coupons, notifications, and issues. **GET /** is the health endpoint.
- The server checks JWT-secret length, configures security middleware/CORS/rate limiting/webhooks, mounts routes, authenticates Socket.IO tokens, and binds to **0.0.0.0**.
- **npm run dev** starts nodemon through **src/scripts/devServer.js**; **npm start** runs **src/server.js**.

### Database models and principal relationships

The database check found 15 model collections. The main relations are:

- **User**: unique email, role, password hash, verification flags, favourites referencing Product, push token, and profile defaults.
- **Category** → Products; **Product** → Category and customization options.
- **Order** → User, Product snapshots, Payment, Coupon, PickupSlot, Table, and optional GroupOrder; order/payment status fields preserve the lifecycle.
- **Payment** → Order/User and optional group contribution; provider/webhook references and manual-verification fields.
- **GroupOrder** → leader and members (Users), items (Products), optional Order, member shares, and contributions.
- **Coupon** and coupon-use records; **Notification** → User/Order; **WebhookEvent** for idempotent webhook processing.
- **PickupSlot** → Orders; **Table** → current Order; **Issue** → User and Order; OTP and Google challenge models hold short-lived auth challenge data.
- Read-only database verification connected successfully and found **0 missing declared indexes**.

### Platform and deployment configuration

- Expo config declares Android package and iOS bundle ID **com.wrapchik.app**, portrait orientation, Android keyboard resize mode, notifications, Expo Router, SecureStore, and Metro web bundling.
- EAS profiles exist for development APK, preview APK, and production. The local Android directory exists; there is no local iOS native directory. EAS project ID is configured.
- **frontend/scripts/start-android-lan.ps1** selects a LAN IPv4 and sets EXPO_PUBLIC_API_URL for that Expo process, checks backend health, and starts Expo. It does not start the backend.
- README, SETUP, DEPLOYMENT, API, Google sign-in, and implementation-history documentation exist.
- The workspace root has no .git metadata, so tracked/untracked status and secret history cannot be verified.

## 3. Feature status

**Status rule:** “Working” requires verification of the feature path, not just source presence. Isolated backend rules are listed under test results; where the full UI/API journey was not run, the feature remains partial. Broken means current source or observed runtime prevents use. Missing means no corresponding implemented screen/API was found.

| # | Feature | Current screen / API / data | Status and evidence |
|---:|---|---|---|
| 1 | Student registration | app/(auth)/signup.jsx; POST /api/auth/register; User, EmailOtpChallenge | 🟡 OTP policy is tested, but live email and registration were not exercised. |
| 2 | Student password login | app/(auth)/login.jsx; POST /api/auth/login; User | 🟡 Backend compatibility tests pass; no live account/UI login. |
| 3 | Admin login and role protection | login and app/admin/_layout.jsx; /api/auth/login, protected /api/admin/*; User | 🟡 Backend role tests pass; no live admin session. |
| 4 | Google sign-in | GoogleSignInButton; /api/auth/google/config, /challenge, /google; GoogleLoginChallenge, User | 🟡 Code exists. Local backend GOOGLE_CLIENT_ID and frontend iOS client ID are absent; provider sign-in unverified. |
| 5 | OTP security rules | login/signup/OTP screens; /api/auth/otp/*; EmailOtpChallenge | 🟡 HMAC storage, expiry, cooldown, single-use, attempt/domain rules have passing tests; no end-to-end email login. |
| 6 | Actual OTP email delivery | auth screens/routes; Gmail SMTP and Resend services | 🟡 SMTP and Resend variables are populated in backend/.env (values withheld), but no real inbox delivery was attempted. |
| 7 | Forgot password | app/(auth)/forgot-password.jsx; /api/auth/password/reset/otp/*; EmailOtpChallenge, User | 🟡 Screen and endpoints exist; real delivery/reset not exercised. |
| 8 | Session persistence/restoration | AuthContext, tokenStore; /api/auth/me; User | 🟡 Auth storage calls are bounded and restoration is optimistic; no device/session test. |
| 9 | Homepage | app/(tabs)/home.jsx; categories/settings/popular-product APIs; Product, Category, RestaurantSettings | 🟡 Backend-data and loading/error/empty code exists; no rendered visual review. No Share a Meal entry. |
| 10 | Menu browsing | home and ProductCard; GET /api/products, /api/categories; Product, Category | 🟡 Code path exists; live catalogue browsing not tested. |
| 11 | Product details/customization | app/product/[id].jsx; GET /api/products/:id; Product | 🟡 Screen and customization logic exist; no live order path. |
| 12 | Search and filters | home SearchBar/category/diet/sort; GET /api/products query filters; Product, Category | 🟡 Implemented in code; no live API search test. |
| 13 | Cart | app/(tabs)/cart.jsx, CartContext; local AsyncStorage | 🟡 Add/update/remove/persist code exists. Cart storage has no timeout, so stalled operations can leave state stale or cleanup pending. |
| 14 | Checkout and authoritative totals | app/checkout.jsx; POST /api/orders, coupon and pickup APIs; Order, Payment, Coupon, PickupSlot | 🟡 Controller tests verify server totals/pending payment; screen not run against a live API. |
| 15 | UPI QR/manual claim | app/payment.jsx; UPI instructions/reference APIs; Order, Payment, RestaurantSettings | 🟡 UPI URI and manual-verification rules are tested. No actual transfer or admin review. |
| 16 | Cash at counter | checkout/admin orders; order creation and admin counter-confirm route; Order, Payment | 🟡 Pending-until-admin-confirm behavior is tested; no live workflow. |
| 17 | Order history/reorder | app/(tabs)/orders.jsx; GET /api/orders/my, POST /:id/reorder; Order | 🟡 Screen and endpoint exist; no authenticated runtime test. |
| 18 | Order tracking | app/order-tracking/[id].jsx; GET /api/orders/:id, Socket.IO order_updated; Order | 🟡 Code/events exist; no live order or socket test. |
| 19 | Profile | app/(tabs)/profile.jsx; /api/auth/me, PUT /api/auth/profile; User | 🟡 Profile/edit/logout code exists; not run with an account. |
| 20 | Favourites | app/favourites.jsx and product detail; /api/auth/favourites*; User.favourites | 🟡 Screen and API exist; no live account test. |
| 21 | Coupons | checkout and app/admin/coupons.jsx; /api/coupons/*; Coupon | 🟡 Validation/reservation logic is unit-tested; not verified against live accounts/catalogue. |
| 22 | In-app notifications | app/notifications.jsx, Header/NotificationContext; /api/notifications; Notification | 🟡 API/context/socket code exists; not tested live. |
| 23 | Push notifications | NotificationContext/service; User push token, Notification | 🟡 Expo registration/server push code exists; no device/provider delivery test. |
| 24 | Create group order | app/group-order.jsx; POST /api/groups; GroupOrder | 🟡 Create screen calls API, but has no normal navigation entry and no live group was created. |
| 25 | Share a Meal/item allocation | product detail and group cart; group item/share/accept APIs; GroupOrder, Order | 🟡 Allocation math tests pass; UI journey is blocked by missing discoverability and group-cart crash. |
| 26 | Split Payment | group cart; quote/checkout/contribution APIs; GroupOrder, Payment, Order | 🟡 Backend allocation logic tested; screen cannot render because of the confirmed crash. |
| 27 | Host Pays | group cart; quote/checkout/contribution APIs; GroupOrder, Payment, Order | 🟡 Backend host-pay rules tested; screen crash prevents use. |
| 28 | Invitation-code join | app/group-order.jsx; POST /api/groups/join; GroupOrder.groupCode | 🟡 Join form/API exist if route is known; no normal navigation entry or live join test. |
| 29 | Group-cart access | lobby button to /group-cart/[id]; GET /api/groups/:id; GroupOrder | ❌ Confirmed render-time ReferenceError prevents screen render. |
| 30 | Group checkout | group-cart; POST /api/groups/:id/quote and /checkout; Order, Payment, GroupOrder | ❌ Backend implementation/unit coverage exists, but customer workflow cannot reach it because screen crashes first. |
| 31 | Realtime group updates | group-order/group-cart and SocketContext; Socket.IO group_updated; GroupOrder | 🟡 Event handling/membership refresh exists; no live socket test. |
| 32 | Admin group-contribution verification | app/admin/orders.jsx; pending/review/reconcile APIs; GroupOrder, Payment, Order | 🟡 Admin actions/backend checks exist; no live admin workflow. |
| 33 | Admin dashboard | app/admin/dashboard.jsx; /api/admin/analytics, /api/settings; Order, Payment, Product, settings | 🟡 Code exists; not run as admin. |
| 34 | Order/kitchen management | app/admin/orders.jsx; /api/admin/orders, status updates; Order, Table, Payment | 🟡 State-transition code/tests exist; no live accept/prepare/ready/complete run. |
| 35 | Menu/category management | app/admin/products.jsx, categories.jsx; protected product/category CRUD; Product, Category | 🟡 Screens/routes exist; no live CRUD test. |
| 36 | Inventory/availability | admin products; PATCH /api/products/:id/availability; Product | 🟡 Route/UI exist; no live update test. |
| 37 | Standard UPI/cash verification | admin orders; payment review/counter endpoints; Payment, Order | 🟡 Backend rules have tests; no live admin review. |
| 38 | Customer management | No admin customer screen or customer-management API found; User exists | ⚪ Not implemented beyond user auth/profile and issue handling. |
| 39 | Analytics | dashboard; GET /api/admin/analytics; Order, Payment, Product | 🟡 Endpoint/dashboard exist; no dataset-backed runtime review. |
| 40 | Coupon administration/promotions | app/admin/coupons.jsx; protected coupon CRUD; Coupon | 🟡 Coupon tooling exists; live behavior unverified. |
| 41 | Admin-managed homepage banners | No banner screen, settings field, or banner model found; home has no banner section | ⚪ Not implemented. |
| 42 | Android | Expo config/EAS development APK profile; native Android directory | 🟡 All-platform Expo export bundles Android JS. No successful current native APK build/phone test. |
| 43 | iOS | Expo iOS bundle ID/config; no local ios directory | 🟡 iOS JS export succeeds; no native build/device test. |
| 44 | Web | Metro web export and Expo Router screens | 🟡 Web bundle exports; no live browser session verified; group-cart crash remains. |
| 45 | Responsive layouts | Shared theme and responsive home/card widths | 🟡 Responsive styles exist; no rendered viewport review. |
| 46 | Keyboard handling | components/common/Input.jsx; login/signup; Android keyboard resize config | 🟡 Shared Input uses native TextInput in a View, not a Pressable wrapper, and forwards focus/editability props. Prior physical keyboard failure is not reverified; ADB/device unavailable. |
| 47 | Navigation | Expo Router screens; static route checker | 🟡 Static checker found 17 targets and 0 missing files. Group order is registered but has no normal home/profile/tab link. |

## 4. Confirmed bugs and limitations

### P0: Group-cart temporal-dead-zone crash

In **frontend/app/group-cart/[id].jsx**, line 24 reads **group?.leaderId** to calculate **isLeader**; **const [group, setGroup] = useState(null)** is declared on line 25. JavaScript throws a ReferenceError because the group binding is accessed before initialization when the component renders. This blocks shared cart, Split Payment, Host Pays, and group checkout UI.

A narrow Babel AST scan found this one same-function lexical-use-before-declaration candidate. It is not a full undefined-variable or runtime analyzer.

### Group ordering is not discoverable

The route is registered and the create/join screen has real groupService API calls, but source-wide search found no home/profile/tab link to **/group-order**. If reached directly, the lobby button opens the group cart, which crashes.

### API and release environment are unavailable

- GET localhost:5000/ and /api/products were unreachable. A prior local startup reported EADDRINUSE; this audit could not identify a current listener and did not stop or start a process.
- frontend/.env and the current process EXPO_PUBLIC_API_URL are absent. EAS preview validation fails because the variable is empty. Public preview/production builds need a real HTTPS backend URL in the matching EAS environment.
- backend/.env has non-empty SMTP/Resend variables; no inbox delivery was attempted. Local Google, Razorpay, and Cashfree credentials were not present in that file.
- Razorpay/Cashfree backend routes are not called by current frontend paymentService, which exposes only manual UPI instructions/reference actions.
- Production CORS denies browser origins unless CORS_ORIGIN is configured.
- CartContext AsyncStorage calls are unbounded. This can stall cart hydration/persistence/cleanup, though it is not confirmed as the global app-hang cause.
- Android keyboard behavior remains unverified. Input.jsx itself has no Pressable that intercepts TextInput touches.
- Expo Doctor is not installed; it was not fetched because dependency installation was prohibited. Expo’s local package check says versions are up to date, but it could not reach the online compatibility map.
- frontend/utils/upiApps.js emits a MODULE_TYPELESS_PACKAGE_JSON test warning, indicating avoidable module parsing overhead.
- No lint script/ESLint dependency or Git metadata was found.

## 5. Frontend integration findings

1. **Share a Meal on homepage:** No. No group CTA or /group-order navigation target is present on home/profile.
2. **Create groups through normal navigation:** No. The create screen exists and calls POST /api/groups, but normal navigation has no link.
3. **Join by invitation code:** Screen and POST /api/groups/join exist, but route is not discoverable normally.
4. **Open group cart:** Lobby button targets /group-cart/:id; render crashes.
5. **Split Payment / Host Pays:** Controls and quote/checkout calls exist in group-cart JSX, but users cannot use them while it crashes.
6. **Do buttons call APIs?** Group create/join, item/share, quote/checkout, contribution, and admin review controls call groupService/adminService endpoints. This is source-confirmed, not a live API result.
7. **Complete group checkout:** Not possible in current frontend due to render crash. No real order was created.
8. **Admin contribution verification:** UI and protected pending/review/reconcile routes exist; no live admin workflow.
9. **Realtime updates:** Authenticated Socket.IO rooms and group/order/notification events exist; runtime handshake was unavailable.
10. **Backend-only payment features:** Razorpay/Cashfree create/reconcile routes exist but are disconnected from customer UI. Current checkout offers UPI QR and counter payment.

## 6. Verification results

| Check | Result |
|---|---|
| Backend tests | npm test: **75 passed, 0 failed** with local loopback allowed. Initial sandbox run failed one rate-limit integration test with OS EACCES on 127.0.0.1; same suite then passed with loopback access. |
| Frontend tests | node --test: **7 passed, 0 failed**; one module-type performance warning. |
| Backend syntax | **84** backend JS files passed node --check. |
| Frontend syntax parse | **86** frontend JS/JSX files parsed using installed Babel parser. |
| Static navigation | node scripts/check-routes.cjs: 17 targets checked, 0 missing route files. This does not prove routes are discoverable or render safely. |
| Dependencies | npm ls --depth=0 passed for frontend/backend. Package/lock root declarations match. npm ci --dry-run --include=dev --ignore-scripts --offline reported up to date; nothing was installed. Frontend lock contains react-native-worklets 0.10.1. |
| Expo compatibility | npx expo install --check says versions are up to date using local metadata; online endpoint unavailable, so the check is limited. |
| Expo Doctor | Not run: expo-doctor is not installed and fetching it is prohibited. |
| Expo export | npx expo export --platform all --output-dir <temporary directory> succeeded: web 3.7 MB, Android 6.3 MB, iOS 6.1 MB JS bundles. Export does not execute React components or build APK/IPA binaries. Existing frontend/dist was not overwritten. |
| Database/index audit | Read-only: connected, 15 collections, 0 missing declared indexes. No documents/indexes modified. |
| API runtime | GET / and /api/products on localhost:5000 unreachable. No health/product success can be claimed. |
| Physical device | ADB is not on PATH; no Android device/emulator test. No iOS device test. |
| Native Android build | No current APK verified. A previous local Gradle attempt lacked an uncached React Native plugin offline; online retry stalled before producing an APK. |
| EAS release config | Preview validator rejects missing EXPO_PUBLIC_API_URL. No preview/production build was run. |

## 7. Security assessment

- Backend uses bcrypt hashing, JWT HS256 verification, auth rate limits, server-side adminOnly guards, protected group membership operations, and payment/webhook signature checks. Tests exercise several rules.
- OTP storage is HMAC-based with expiry, cooldown, attempt caps, one-time consumption, and @thapar.edu validation. Tests pass; real SMTP inbox delivery is unproven.
- Payment success is not inferred from opening a UPI app or submitting a reference. Manual UPI/cash remain pending until admin verification. No payment/order was created.
- Source scan found no obvious hardcoded private-key/API-key/database-URI patterns. Actual local .env values were not printed. .gitignore excludes .env and .env.*, but absent Git metadata prevents checking committed history.
- Local backend .env has SMTP and Resend configuration; Google, Razorpay, and Cashfree keys are absent. frontend/.env is absent. Keep credentials outside source.
- Production CORS needs explicit CORS_ORIGIN. EAS preview/production requires HTTPS EXPO_PUBLIC_API_URL. Google needs backend GOOGLE_CLIENT_ID, Android OAuth/signing fingerprints, and iOS client ID in the build environment.
- This is a source/config audit, not penetration testing, provider verification, or a production-secret history scan.

## 8. Professional quality scores

Scores are code-level estimates, not judgments from rendered screens; no browser/device visual review was possible.

| Category | Score / 10 | Basis |
|---|---:|---|
| UI design | 6 | Shared theme and reusable states/cards; no visual QA. |
| Mobile usability | 4 | Native input structure/config exist, but prior keyboard failure has no current device retest. |
| Navigation | 4 | Static targets resolve; group entry is missing and group cart crashes. |
| Performance | 5 | API timeouts, auth storage bounds and debounced search exist; cart storage is unbounded; no profiling. |
| Authentication | 6 | Password/OTP/RBAC code has tests; live delivery and Google credentials are unverified/missing. |
| Ordering experience | 5 | Customer screens and server pricing exist; no live order path tested. |
| Payment reliability | 4 | Manual verification is safe; no real transfer/provider setup and gateway UI is disconnected. |
| Group ordering | 2 | Backend rules are extensive/tested, but entry is missing and group cart crashes. |
| Admin experience | 5 | Dashboard/CRUD screens exist; no live admin run and no customer management. |
| Security | 7 | JWT/RBAC, rate limits, OTP HMAC/payment validation exist; runtime/configuration unverified. |
| Production readiness | 3 | API/EAS URL absent, backend unavailable, no current APK/device test, provider setup incomplete. |

## 9. Prioritized improvement plan

### P0 — Stop the crash and restore a verifiable local runtime

1. **Fix group-cart TDZ.** Problem/root: group is read before its lexical state declaration. Files: frontend/app/group-cart/[id].jsx lines 24–25. Fix: move isLeader below the group state hook. Dependencies: none. Complexity: Small. Verify by opening a group cart in web and Android development builds as leader and member.
2. **Identify/recover the local API listener.** Problem/root: localhost:5000 is unreachable; prior startup reported EADDRINUSE, current owner unknown. Files/config: backend/src/server.js, backend/src/scripts/devServer.js, local process state. Fix: identify exact owner before reuse/termination; start only one nodemon backend after resolution. Dependencies: MongoDB/backend .env. Complexity: Medium. Verify GET /, GET /api/products, authenticated Socket.IO handshake.
3. **Configure frontend API URL.** Problem/root: no frontend .env/process URL; preview validator rejects missing URL. Config: EAS environment and EXPO_PUBLIC_API_URL; frontend/scripts/validate-api-url.cjs and start-android-lan.ps1. Fix: use LAN helper for development; set real HTTPS URL in preview/production. Dependencies: reachable backend. Complexity: Small locally, Medium for deployment. Verify validator and phone health request.

### P1 — Make core flows reachable and reliable

4. **Expose group ordering in normal navigation.** Problem/root: no inbound home/profile/tab route. Files: frontend/app/(tabs)/home.jsx, optionally profile. Fix: add visible Share a Meal/Group Order entry. Dependencies: none. Complexity: Small. Verify create/join without manually entering route.
5. **Run complete customer/admin flows against real local services.** Problem: no authenticated live API workflow verified. Screens: auth, product, cart, checkout, payment, order, admin orders. Fix: test login → browse → customize → checkout → pending payment → admin review; separately test order transitions. Do not fake payments. Dependencies: backend/database, test accounts, SMTP, outlet settings. Complexity: Large. Verify every API/state/error transition.
6. **Bound cart storage operations.** Problem/root: CartContext AsyncStorage calls lack timeouts unlike tokenStore. File: frontend/context/CartContext.jsx. Fix: bound hydration, persistence, and clear operations so stalled storage cannot hold cart state/cleanup. Dependencies: none. Complexity: Small/Medium. Verify delayed/rejected storage and normal restore.
7. **Verify real OTP delivery.** Problem: provider variables exist locally but no inbox was tested. Files: auth controller, Gmail/Resend services, backend/.env config. Fix: send a real OTP to an authorized @thapar.edu inbox and verify expiry/resend/attempts without logging codes. Dependencies: valid sender and reachable API. Complexity: Medium. Verify delivery and sign-in.
8. **Retest historical Android keyboard failure.** Problem: previous OnePlus Nord 4 report; current inspection cannot verify hardware. Files: common/Input.jsx, login/signup, native build. Fix: install current dev build and inspect focus/IME logs before code changes. Dependencies: device and ADB. Complexity: Medium. Verify tap, focus, IME show, typing, scroll, repeat navigation.
9. **Decide gateway scope.** Problem: Razorpay/Cashfree backend APIs exist but frontend only supports manual UPI service; local gateway credentials absent. Files: paymentService, checkout/payment screens, backend payment controllers/routes, env example. Fix: wire provider flow to UI using sandbox credentials or document as backend-only/legacy. Dependencies: sandbox credentials/webhook endpoint. Complexity: Large. Verify duplicate/failure/cancellation/signature cases without real charges.

### P2 — Complete missing product/admin capabilities

10. **Add customer management or remove it from scope.** Problem: no admin customer route/screen. Files: new admin route/controller/screen using User. Fix: implement paginated protected customer lookup and only approved safe actions. Dependencies: authorization/privacy rules. Complexity: Medium/Large. Verify admin-only access.
11. **Add admin-managed promotional banners or remove the promise.** Problem: no banner model/settings/UI. Files: settings/promotion model, admin settings, home, API. Fix: add minimal active/date-window banner management. Dependencies: admin validation. Complexity: Medium. Verify create/edit/customer display.
12. **Verify push notification delivery.** Problem: no device/provider delivery test; EXPO_ACCESS_TOKEN absent locally. Files: notification service/controller, Expo config, EAS credentials. Fix: provision platform push credentials and test notification navigation. Dependencies: device/build credentials. Complexity: Medium. Verify foreground/background/tap flows.

### P3/P4 — Polish and release

13. **Perform rendered visual/responsive review.** Problem: design ratings are source-only. Files: customer/admin screens and shared components. Fix: inspect web/Android at phone, tablet, desktop widths; correct measured overflow/alignment. Dependencies: running backend/test accounts. Complexity: Medium. Verify screenshots and empty/error/navigation states.
14. **Complete release setup.** Problem: preview URL, Google OAuth, production CORS and payment provider credentials are not configured/verified. Files: SETUP.md, DEPLOYMENT.md, GOOGLE_SIGN_IN.md, EAS environments. Fix: configure credentials outside source and run a signed EAS build. Dependencies: HTTPS API and provider setup. Complexity: Large. Verify clean build, installation, login and production origin policy.

## 10. Recommended next steps for Claude

1. First fix the exact group state initialization order in frontend/app/group-cart/[id].jsx; do not bundle it with a redesign.
2. Add a normal Share a Meal route entry and prove the group screen opens.
3. Restore one healthy backend process on port 5000 only after identifying the current listener.
4. Configure EXPO_PUBLIC_API_URL for the actual device/build environment.
5. Run the live customer/admin flows, then inspect keyboard behavior on a physical Android phone.
6. Keep payments pending until provider confirmation or manual admin verification; do not create fake successful orders.

### Final counts

- **Feature areas inspected:** 47
- **Fully working end-to-end verified:** 0
- **Partially implemented or runtime-unverified:** 43
- **Broken:** 2 (group-cart render and group checkout journey blocked by that render)
- **Not implemented:** 2 (admin customer management and admin-managed homepage banners)
- **Overall implementation estimate:** approximately 60%; runtime/production readiness is lower.

### Top 10 urgent fixes

1. Fix the group-cart initialization crash.
2. Identify the process/condition behind the port 5000 conflict and restore one healthy backend.
3. Configure EXPO_PUBLIC_API_URL for local phone testing and HTTPS EAS builds.
4. Add a normal Share a Meal entry point to navigation.
5. Test the full customer checkout and order-tracking workflow against the live local API.
6. Test admin order progression and manual payment verification with an admin session.
7. Verify OTP delivery to a real @thapar.edu inbox and exercise reset/signup flows.
8. Bound CartContext AsyncStorage operations.
9. Rebuild and verify keyboard focus/typing on a physical Android phone.
10. Configure Google OAuth IDs and signing fingerprints before claiming Google sign-in readiness.

