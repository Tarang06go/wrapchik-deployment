# Wrapchik API Reference

Base path: `/api`. JSON API routes use the standard `{ success, message?, ... }` response shape where applicable. Authenticated requests use `Authorization: Bearer <JWT>`. Admin routes require a persisted `admin` role. This route inventory is derived from source. On 2026-11-20, read-only `GET /`, `GET /health` and `GET /api/products` requests returned HTTP 200; live email OTP and database write behavior were not verified.

## Public and account routes

| Route | Access | Purpose |
|---|---|---|
| `GET /` | Public | API health response (outside `/api`). |
| `GET /health` | Public | Operational health probe; HTTP 200 when MongoDB is connected, HTTP 503 with `database: disconnected` otherwise. |
| `GET /api/health` | Public | API-path alias of `/health`, for client-side connection checks. |
| `GET /api/categories` | Public | Menu categories. |
| `GET /api/products` | Public | Search/filter/sort menu products. Search is treated as literal text; price range is validated. `stock: null` means unlimited; zero stock is not orderable. |
| `GET /api/products/popular` | Public | Up to four available items ranked from paid orders in the prior 30 days. Empty data returns an empty list. |
| `GET /api/products/:id/paired` | Public | Up to four in-stock items frequently bought with this item, calculated from verified completed orders. |
| `GET /api/products/recommended` | Authenticated | Returns `products` bought alongside items in the customer's three most recent verified completed orders and `previouslyOrderedProducts` from the current catalogue, in purchase-recency order. Both arrays are empty until qualifying history exists. |
| `GET /api/products/:id` | Public | Product details/options. |
| `POST /api/products`, `PUT /api/products/:id` | Admin | Product CRUD accepts additive `stock` as a non-negative integer; `null` means unlimited. New orders reserve finite stock atomically, and unprocessed orders return reserved units on customer cancel or admin reject/cancel. Existing catalogue rows and historical orders are unchanged. |
| `GET /api/settings` | Public | Outlet settings needed by checkout, the configured active-order age threshold, optional single legacy banner, and up to five admin-managed carousel banners. |
| `GET /api/admin/orders?status=ACTIVE&page=1` | Admin | Active kitchen queue (`PLACED`, `ACCEPTED`, `PREPARING`, `READY`) ordered oldest first. Other individual status filters are available for order history. |
| `GET /api/tables/available` | Public | Dine-in availability without admin reservation details. |
| `GET /api/pickup-slots` | Public | Available scheduled takeaway slots when enabled. |
| `/api/auth/register`, `/login`, `/otp/send`, `/otp/verify` | Public, rate limited | Registration requests a signup code for an exact `@thapar.edu` address; the student account is created only after `SIGNUP` OTP verification. Password login and OTP login remain domain-independent for existing users, including admins. OTP payloads use email; local OTP must only be enabled in development. |
| `/api/auth/me`, `/profile`, `/favourites` | Authenticated | Own account/profile/favourites. |
| `GET /api/coupons/available` | Authenticated | Coupons available to this account right now; student-only restrictions require a verified `@thapar.edu` address. |
| `GET /api/loyalty/me` | Authenticated student | Current points balance, lifetime points, configured tier and the latest 30 append-only ledger entries. |
| `POST /api/loyalty/quote` | Authenticated student | Server-reprices the cart and optional coupon, then validates requested loyalty points against the current balance, outlet-configured value and redemption cap. Quote only; order creation rechecks and reserves points. |
| `GET /api/reviews/:orderId`, `POST /api/reviews/:orderId` | Owning student | Read or submit one 1–5 star review after the order is paid and completed. Comments are optional, capped at 500 characters; duplicate submissions return 409. |
| `POST /api/coupons/validate` | Authenticated | Backend eligibility quote against current product prices, customer redemption count, optional student restriction, weekdays and India-local time window. |
| `/api/orders` | Authenticated | Create order with optional server-calculated `loyaltyPoints` redemption, read own orders/details, cancel eligible unpaid order, request reorder data. |
| `POST /api/orders/:id/pickup-qr` | Owning customer | Issue a 30-minute one-time QR only for a paid, READY, non-group takeaway order. The QR deep-links to the installed Wrapchik admin app. |
| `/api/notifications` | Authenticated | Read own notifications and mark own notifications read. |
| `/api/issues` | Authenticated | Submit/list own support issues; submission requires ownership of a completed order. |
| `POST /api/groups` | Authenticated student | Create a 2–8 member invite lobby. Delivery groups require a hostel and room/pickup point; invites expire after two hours. |
| `POST /api/groups/join` | Authenticated student | Join an open invite with a six-character code. Capacity is enforced atomically. |
| `GET /api/groups/:id` | Current member | Read active membership and the synchronized shared cart. |
| `POST /api/groups/:id/items` | Current member, open group | Add a product with quantity/customizations. The API reloads current product prices. Optional `sharedWith` starts a shared dish with equal shares requiring each participant's acceptance. |
| `PATCH /api/groups/:id/items/:itemId` | Item owner, open group | Update quantity/customizations at current server prices; shared-dish acceptances reset after an edit. |
| `PUT /api/groups/:id/items/:itemId/shares` | Item owner, open group | Propose equal shares with `{ userIds }`, or custom `{ allocations: [{ userId, percentageBps }] }`; shares must total 10,000 basis points. Every participant must accept the current item revision. |
| `POST /api/groups/:id/items/:itemId/accept` | Assigned participant, open group | Accept only the caller's currently assigned share. |
| `DELETE /api/groups/:id/items/:itemId` | Item owner, open group | Remove own item. |
| `POST /api/groups/:id/lock` | Group leader | Close invites after at least two active students join and every shared-dish share is accepted. |
| `POST /api/groups/:id/quote` | Current member, locked group | Return server-priced subtotal, eligible coupon, tax/fee estimate and deterministic member share breakdown. This is a preview only; checkout recalculates everything. |
| `POST /api/groups/:id/leave` | Current member | Leave before lock; leadership transfers to the earliest active member. A last-member exit cancels the invite. |
| `DELETE /api/groups/:id/members/:userId` | Group leader | Remove a member before lock. |
| `POST /api/groups/:id/checkout` | Group leader, locked group | Create one server-priced kitchen order with `{ checkoutMode: 'SPLIT'|'HOST_PAYS', paymentMethod: 'UPI_QR'|'COUNTER', couponCode? }`. Rejects changed prices and unaccepted shared-dish allocations. Checkout is idempotent per group. |
| `GET /api/groups/:id/contributions/:contributionId/upi` | Assigned member | Return an amount-specific UPI intent and order reference for the member's contribution. The UPI redirect is not proof of payment. |
| `POST /api/groups/:id/contributions/:contributionId/upi-reference` | Assigned member | Submit a UPI transaction reference; status stays pending until the outlet checks its receipt. |
| `GET /api/groups/admin/contributions/pending` | Admin | List pending UPI/cash group contributions and any fully verified contribution sets that still need order reconciliation. |
| `POST /api/groups/:id/contributions/:contributionId/review` | Admin | Verify a received contribution or reject a UPI claim with a reason. Cash can only be verified, not rejected. |
| `POST /api/groups/admin/:id/reconcile-payment` | Admin | Reconcile saved verified payment records after all contributions sum exactly to the immutable order total. Does not create or simulate payment. |

The app invite link uses the configured `wrapchik://group/<six-character-code>` scheme and redirects to the existing authenticated join screen. The join endpoint still enforces student role, invite expiry and capacity.

Group ordering now supports a live shared cart, per-member item ownership, shared dishes, backend-validated menu snapshots, integer-paise allocations, participant acceptance, and acceptance invalidation after edits. A locked group can be checked out to one existing `Order`; its item records keep the owner and item-level shares. Coupon discount is allocated by item responsibility, tax by discounted responsibility, and delivery fee equally with deterministic paise rounding. Split mode creates one outlet payment obligation per member with a positive share. Host-pays creates one payment obligation for the complete order and shows other member shares as informational only. UPI transaction references and counter receipts remain pending until an admin verifies each contribution. The order becomes payment-successful only after saved contribution payment records are checked and their sum matches the order total. Kitchen acceptance stays blocked until then. These capabilities were implemented after the mid-term report; they must not be represented as mid-term features.

Pickup QR tokens are HMAC-SHA256 signed with the existing server `JWT_SECRET`; only their SHA-256 digest is stored in MongoDB. Tokens are generated only after a normal takeaway is READY and payment is verified, expire after 30 minutes, and are consumed atomically by the admin endpoint. They cannot confirm payment, complete a group order, or be reused after successful pickup.

UPI references are checked against current and legacy payment records. New references store only a SHA-256 reference hash for a sparse unique index; the readable transaction reference remains available to the admin verification queue. To ensure the index on an existing MongoDB database, run `cd backend; node src/scripts/ensureUpiReferenceIndex.js`. The script checks for duplicate stored hashes and stops without modifying payment records if any are found.

## Administrator routes

All `/api/admin/*` routes require `protect` and `adminOnly`.

- `GET /api/admin/orders`, `PUT /api/admin/orders/:id/status`. `ACTIVE` returns actionable kitchen orders oldest first; `REJECTED` requires a non-empty 1–500 character reason. Active-order age is highlighted at the outlet's configured `orderOverdueMinutes` threshold (default 30, range 1–240).
- `GET /api/admin/analytics?period=today|7d|30d`
- `GET /api/admin/customers?page=1&limit=30&search=...` returns student account status and counts/spend derived only from verified, non-cancelled orders. Search is literal and paginated.
- `PATCH /api/admin/customers/:id/status` accepts `{ "isActive": true|false }` for student accounts only. Every change is recorded in `CustomerAccountAudit`; disabling immediately rejects password, OTP, Google token and authenticated socket/API access. Admin accounts cannot be changed through this route.
- `POST /api/admin/orders/:id/pickup/verify` consumes `{ "token": "…" }`. Admin-only; atomically completes one paid, READY takeaway order, stores the verifying admin and time, and leaves payment state unchanged.
- `GET /api/admin/issues`, `PUT /api/admin/issues/:id/resolve`
- Product create/update/availability/delete under `/api/products`.
- Category create/update/delete under `/api/categories`.
- Table list/create/update under `/api/tables`.
- `PUT /api/settings`; `orderOverdueMinutes` configures active-order overdue highlighting from 1 to 240 minutes (default 30). `promoBanners` accepts up to five campaigns with a fixed internal route, optional HTTPS `res.cloudinary.com` image, optional ISO start/end dates and a sort order. The order desk reads this setting and sorts `ACTIVE` orders oldest first.
- `GET /api/settings` includes the optional admin-managed `promoBanner`; its button route is restricted to the existing internal destinations `/(tabs)/home`, `/(tabs)/menu`, or `/group-order`. `PUT /api/settings` validates the banner before publishing it. It is disabled by default and has no effect on product prices or payments.
- Coupon list/create/update under `/api/coupons`.

Coupons may optionally restrict eligibility to verified Thapar student accounts and/or India-local weekdays and `HH:mm` time windows (including overnight windows). Legacy coupons default to unrestricted days/hours and non-student-only behavior.

Menu integrity can be reviewed without changing catalogue data with `cd backend; npm run db:audit-menu` after setting `MENU_AUDIT_MONGO_URI` to a read-only MongoDB URI. The script requires `--dry-run`, does not fall back to the app database URI, and can compare names/prices only when `MENU_REFERENCE_JSON` points to a trusted JSON array of `{name, price}` entries.

## Payment routes

- `POST /api/payment/create`, `/verify`, `/outcome` require the order owner.
- `POST /api/payment/counter-confirm` requires an administrator.
- `POST /api/payment/webhook` is provider-to-server and verifies Razorpay's signature over the raw request body. Use Razorpay test mode until test reconciliation and webhook replay behavior are verified.
- Online orders cannot enter kitchen preparation before server-confirmed payment. Browser checkout is not supported by the native Razorpay module. Refunds are not implemented.

## Data/financial rules

- Client-supplied prices and discounts are not accepted as authoritative. The backend reloads products and options and stores order-time item snapshots.
- Coupon quote is informational; order creation rechecks dates, minimum subtotal and usage limits atomically.
- Tracking estimates use the average accepted-to-ready duration from at least five completed orders of the same fulfillment type and India-local order hour over the prior 60 days. The result is cached for five minutes; sparse history or an aggregation error uses the outlet estimate saved with the order.
- Loyalty earning is disabled until an administrator configures and enables an outlet policy. The policy sets spend blocks, points per block, paise per point, minimum redemption, a maximum redemption percentage (capped at 50%), and lifetime tier thresholds. Existing balances can still be redeemed while new earning is paused if the outlet keeps redemption terms configured. Redemption is reserved during individual order creation; unpaid cancellation or admin rejection returns the points. Points accrue only after payment success and completed fulfilment; group orders are excluded. New orders snapshot their earning rule. The app defines no default financial values or expiry policy.
- Scheduled pickup availability is informational; order creation revalidates operating hours, lead time and slot capacity atomically.
- Payment state is independent from order state. A client dismissal does not prove payment failure or success.

Deployment and environment setup guidance is in the repository's `DEPLOYMENT.md` and `SETUP.md`.

Before enabling new review or loyalty records on a separate database, first preview the additive index migration with `cd backend; npm run db:loyalty-indexes`; after reviewing the duplicate check, explicitly apply with `npm run db:loyalty-indexes -- --apply`. The script checks duplicates and never changes documents. `npm run db:check` reports expected review and loyalty indexes.

## Completion sprint endpoints and verification — 2026-11-07

- `POST /api/auth/password/reset/otp/send` and `/verify` provide email OTP password recovery. Email payloads use `email`; real delivery requires backend Resend configuration. Responses are generic for missing accounts when delivery is configured.
- `POST /api/payment/reconcile` is authenticated and owner-scoped; it fetches provider payment state to resolve pending/failed attempts. It does not accept client-side success as proof.
- Razorpay webhook handling validates HMAC and event ID, records a sanitized event in `WebhookEvent`, and acknowledges already processed duplicates. The event ledger has durable uniqueness and processing leases.
- Live read-only verification on 2026-11-07: `GET /` ACTIVE, `GET /api/products` HTTP 200 (5 items), Socket.IO polling handshake HTTP 200. No order, payment, cancellation or admin mutation endpoint was exercised in this check.
