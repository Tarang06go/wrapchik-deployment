# Wrapchik Deployment Guide

Nothing was deployed or published. Keep development, staging and production databases and credentials separate.

## Current deployment status — 2026-11-22

| Work item | Status | Evidence |
| --- | --- | --- |
| Render/Expo/PWA deployment configuration and safety checks | DONE | Blueprint, release URL validation, PWA export and manual EAS Update workflow are in source. |
| Automated local tests and Android/iOS/web JS exports | DONE | Latest full results are recorded in PROGRESS.md (2026-11-21); not rerun during this access-only recheck. |
| GitHub repository and automatic deployment | BLOCKED | Reviewed source is committed locally as `5ccedc1` (174 files); worktree is clean and local `.env` files were excluded. No remote or private repo exists. `gh auth status` reports an invalid token and `api.github.com` DNS lookup failure. |
| Atlas demo project/cluster/app user | DONE | Created a separate Wrapchik Demo project, AWS Singapore Free cluster (Atlas state IDLE), and cluster-scoped app user with readWrite limited to wrapchik_demo. Credentials are kept out of source/docs. |
| Atlas app access and catalogue inventory/import | BLOCKED | Render service egress ranges and read-only source-database access are not available. Import still requires the source/destination inventory and explicit approval. |
| Public Render API and database readiness | BLOCKED | No Wrapchik service exists in Render; `/ready` has not been checked against hosted MongoDB. The connected Render tools do not expose a zero-spend/overage control, so the account cannot yet be verified safe from billing. |
| Public website and iPhone Home Screen PWA | BLOCKED | Export configuration exists, but there is no hosted HTTPS origin or deployed API. |
| Standalone Android preview APK | BLOCKED | No public HTTPS API value or Expo token/session; the EAS identity check cannot resolve `api.expo.dev`; no build was started. |
| Google OAuth, email delivery, browser/device flows | UNVERIFIED | Client/server configuration paths exist, but hosted credentials and real provider/device verification are absent. |
| Physical Android/iPhone acceptance | UNVERIFIED | No connected handset test was performed. |

## Suggested hosting shape

- **Client:** Expo EAS builds. The app identifier and EAS project ID are already configured in the frontend.
- **iPhone/web:** `npm run export:web` emits the static web shell plus standalone PWA manifest, Apple home-screen metadata, and a 1024px Wrapchik icon. Host the exported `dist/` directory over HTTPS and configure SPA route rewrites; on iPhone, open the HTTPS site in Safari and choose **Share → Add to Home Screen**. This is an online client; it does not cache authenticated account, cart, or payment data for offline use.
- **API:** a managed Node host with persistent Express + Socket.IO support, TLS, health checks, environment secrets, logs and reliable uptime. Render is one prototype option, but its free services can suspend and its documentation says free instances are not for production. Use paid always-on compute for outlet operations.
- **Database:** MongoDB Atlas. M0 is a small development/proof-of-concept tier (512 MB shared cluster); choose a paid tier and backups suitable for the outlet before launch.
- **Images:** existing catalogue URLs remain. Campaign banners accept already-hosted HTTPS Cloudinary URLs; upload is performed through Cloudinary's own console. No Cloudinary API credential or direct upload endpoint is present in this codebase, and customer functionality does not require Cloudinary for ordinary ordering.
- **Payments:** New orders use cash at counter or outlet-configured UPI with manual administrator verification. Legacy gateway records remain supported for historical orders.
- **Push:** configure Expo project and Android Firebase credentials for EAS builds, then verify delivery on a real test device.

The repository [`render.yaml`](render.yaml) now defines a one-instance Render Free API and a separate static web/PWA site. The API uses Render-managed HTTPS, `/health`, a generated `JWT_SECRET`, and prompts for `MONGO_URI`, exact `CORS_ORIGIN`, Resend, and Google credentials instead of storing them in source. The static build validates `EXPO_PUBLIC_API_URL`, exports the PWA, and rewrites app routes to `index.html`. Keep `numInstances: 1` while rate limits and group-expiry scheduling use process memory. The Blueprint does not deploy until this repository is connected to Render and external values are entered.

For a zero-cost classroom/demo deployment, a suspended free web service and Atlas M0 can be evaluated if current provider terms allow it. Expect cold starts and finite shared storage; Atlas M0 has a 512 MB storage limit and does not provide automated backups. It is not a suitable reliability commitment for live outlet service. Recheck current plan limits and terms before choosing providers; a free health pinger cannot make a suspended service production-reliable.

Prices and limits change. Review current provider terms before committing spend: [MongoDB Atlas pricing](https://www.mongodb.com/pricing), [Render free-service limitations](https://render.com/docs/free), [Render pricing](https://render.com/pricing), and [Expo EAS plans](https://docs.expo.dev/billing/plans/). Free tiers suit demos/prototypes; do not infer production suitability from a $0 tier.

## Development

- Local MongoDB and local Express/Socket.IO backend.
- `NODE_ENV=development`; keep `SEED_SAMPLE_CATALOGUE=false` unless deliberately using a disposable database.
- Enable local OTP only in a disposable development environment.
- Keep the existing live catalogue and records intact.

### Google OAuth client setup

Student sign-in accepts only verified `@thapar.edu` identities; administrators continue to use their separate password login. In Google Cloud Console, configure the OAuth consent screen and create OAuth clients for the same project:

- **Web application:** set its client ID as backend `GOOGLE_CLIENT_ID` (ID token audience) and frontend `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (used by the native SDK). Add the hosted web origin and authorized JavaScript origin for web sign-in.
- **Android:** package/application ID is `com.wrapchik.app`. Register the SHA-1 of the certificate that signs the installed build: EAS Android credentials SHA-1 for EAS builds, or the local debug/release keystore SHA-1 for locally signed builds. Put the public client ID in `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` for config visibility; the Google Android client is identified by package and certificate. Rebuild after changing OAuth identifiers.
- **iOS:** bundle ID is `com.wrapchik.app`. Set its public client ID as `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`; app config derives the URL scheme. Rebuild after changing it.

Keep all three `EXPO_PUBLIC_*` values in the EAS environment or local frontend `.env`, and keep `GOOGLE_CLIENT_ID` only in the backend secret store. The native Google module requires a development/preview/production build; Expo Go uses the existing student email OTP fallback. Real Google OAuth remains unverified until tested with configured clients on a device.

### Health and CORS

`GET /health` is lightweight process liveness and returns HTTP 200 while Express is running. `GET /ready` is database-aware and returns HTTP 503 while MongoDB is disconnected; `/api/health` remains a readiness-compatible alias. The server binds first and retries MongoDB with capped backoff, so an Atlas outage/cold start does not block liveness. Group expiry is rechecked after startup connection and on its existing interval. Set production `CORS_ORIGIN` to the exact deployed HTTPS web origin. HTTP and Socket.IO share the same origin list; native Android/iOS requests do not use browser CORS.

The frontend checks `/ready` on retry. It retains catalogue caching and the API client retries only safe GET requests; order/payment mutations are not automatically retried. Do not add traffic pingers. Render Free services suspend after 15 minutes without traffic and can take about a minute to resume; outbound SMTP ports are blocked. Use the HTTPS Resend provider on Render Free and leave Gmail SMTP variables unset there. See [Render Free limits](https://render.com/docs/free) and [Render WebSocket support](https://render.com/docs/websocket).

### Campus directions

The outlet directions control opens a free Google Maps URL on Android, iOS, and web using the pickup location from public outlet settings (with a TIET SAC fallback). No embedded map tiles, paid maps SDK, API key or GPS permission is required; verify the outlet pin and label with the campus before publishing a customer-facing address.

## Staging

- Create a separate Atlas free demonstration cluster/database (suggested database name `wrapchik_demo`) and a least-privilege database user with access only to that database. In Atlas, allowlist the outbound CIDR ranges shown for the Render API service/region; do not use `0.0.0.0/0` unless the hosting provider leaves no narrower option. Atlas explicitly warns that `/0` allows connections from anywhere. See [Render outbound IP ranges](https://render.com/docs/outbound-ip-addresses) and [Atlas IP access lists](https://www.mongodb.com/docs/atlas/security/ip-access-list/).
- Deploy the API behind HTTPS. Set exact `CORS_ORIGIN`, `TRUST_PROXY_HOPS` to the reverse-proxy hop count, a random `JWT_SECRET`, a dedicated Atlas `MONGO_URI`, and a verified HTTPS email sender (`RESEND_API_KEY` + `EMAIL_FROM`). Render Free blocks outbound SMTP ports, so do not set `SMTP_USER`/`SMTP_APP_PASSWORD` there. Keep private credentials in the backend host’s secret manager.
- Set the Expo staging environment’s `EXPO_PUBLIC_API_URL` to the HTTPS API URL. Never put private keys in Expo public variables.
- Verify cash and UPI workflows using clearly identified staging data; keep UPI payment pending until an administrator verifies actual receipt.

Before any catalogue import, inventory the read-only local source and empty demo destination identities/counts, then request explicit approval. Copy only products, categories, and non-sensitive catalogue settings. Never copy users, orders, OTPs, payments, or sessions. This repository session did not have a running MongoDB source or Atlas account, so no inventory/import was performed.

## Production preparation (not completed or authorized)

- Obtain outlet/institution owner approval, verified email sender, Firebase/Expo ownership, and production project linking.
- Use a new production MongoDB database; never reset or reseed it. Select backups/PITR, retention, access policies and monitoring. Rehearse restores into a separate database.
- Require HTTPS for app/API/webhooks. Restrict CORS to approved origins. Store credentials in host secret manager and document rotation.
- Monitor `GET /`, API error rate, process restarts, MongoDB health, Socket.IO disconnects, webhook failures, pending reconciliation, email delivery and push tickets.
- Define verified-payment order handling, cash closeout, UPI review, refunds/cancellations and support escalation before live operations.
- Require final owner review and explicit deployment approval before publishing EAS builds or routing production traffic.

## Release checks

1. Run clean installs from the backend and frontend lockfiles, then run available backend tests.
2. Verify web and Android exports and build/install a preview APK.
3. Test customer/admin, cash/UPI verification, and push workflows with separate staging data and a physical device.
4. Review security and dependency findings; do not blindly apply an Expo major upgrade.
5. Test backup restore and outlet operating procedures before production use.

## Build commands

From PowerShell, after the matching EAS environment has an HTTPS `EXPO_PUBLIC_API_URL` and required OAuth client IDs:

```powershell
Set-Location 'C:\Users\Tarang\Desktop\wrapchik\wrapchik_upgraded_16\wrapchik\frontend'
eas build --platform android --profile development
eas build --platform android --profile preview
eas build --platform android --profile production
```

`development` creates an internal development-client APK; after installing it, start its Metro server with `npx expo start --dev-client --lan`. Configure that EAS environment with a reachable development `EXPO_PUBLIC_API_URL` (for phone testing, use the laptop's LAN URL). `preview` creates an internally distributed standalone Android APK; configure its EAS `preview` environment with the public HTTPS API URL and required public OAuth client IDs. `production` creates the Android release bundle. Preview/production checks reject missing, placeholder, loopback, emulator, private LAN, and non-HTTPS API URLs. App version is now **1.0.1** with Android `versionCode 2`; the `appVersion` runtime advances with it for native compatibility. EAS authentication/signing credentials, Google OAuth clients, Atlas, and deployed URLs remain external; JavaScript exports do not verify them.

### EAS Update channels

The existing Expo project ID, update URL, SDK-matched `expo-updates`, `appVersion` runtime policy, and development/preview/production channels are preserved. CI compares Expo/native dependencies, plugins, Android/iOS files, and native config against the installed build baseline, and requires a higher app version for native changes. The manually triggered [EAS Update workflow](.github/workflows/eas-update.yml) requires an explicit channel, native baseline commit, message, `EXPO_TOKEN` secret, matching public HTTPS EAS API variable, all tests, and an affirmative publish confirmation. SDK 57 updates use the selected Expo environment, not local `.env`; see [Expo environment variables](https://docs.expo.dev/eas/environment-variables/usage/). Roll back a published update with `eas update:rollback`; the CLI guides the rollback to an earlier update or embedded build. See [Expo rollback guidance](https://docs.expo.dev/eas-update/rollbacks/). No update was published here.

Render deploys from its connected Git branch by default. This repository has no Git remote configured, so automatic GitHub-to-Render deployment is prepared in the Blueprint but not connected or exercised. Connect the repository and enable the Blueprint services after the demo database and public URLs are ready.

**Deployment attempt (2026-11-22):** Secret scan passed across 378 Git-visible files; ignored local environment files were excluded, and the only staged env template is `.env.example` with placeholders. The reviewed source was committed locally as `5ccedc1` (`Prepare Wrapchik deployment release`, 174 files); no Git remote exists and the worktree is clean. GitHub CLI 2.105.0 reports the `Tarang06go` token is invalid and DNS cannot resolve `api.github.com`, so a private repository could not be created or pushed. The exact unblock command, after network/DNS works, is `gh auth login -h github.com -p https -w`; complete its browser flow without sharing the token. Render contains only unrelated services; no Wrapchik Blueprint was provisioned because the source cannot yet be pushed. The connected Render tools provide no account billing/overage control, so zero-spend exposure cannot be verified. Atlas inspection found no requested existing project/cluster, so a `Wrapchik Demo` project and Free AWS Singapore cluster were created, with a cluster-scoped user limited to `readWrite` on `wrapchik_demo`; the cluster is IDLE and no network allowlist is open. This differs from the requested reuse because the named existing Atlas resources were absent. Do not import catalogue data until source/destination inventory is available and the user approves the dry-run. EAS identity checks cannot resolve `api.expo.dev`; no Expo session/token, public API URL, website origin, Render service, or APK exists. No existing student accounts, orders, payments, or catalogue records were copied or modified.

Render Free web services can suspend after 15 minutes idle and may take about a minute to resume; Render also documents usage overages and warns that Free services are not intended for production. Treat the current free configuration as a demo deployment only. Before adding services, verify a zero-spend account limit or that no billable overage path is enabled. See [Render Free limits](https://render.com/docs/free).

## Automated CI and rate limits

`.github/workflows/ci.yml` runs clean lockfile installs, backend/frontend tests, route/import checks, native runtime compatibility, high-confidence secret scanning, Expo dependency compatibility, and web/Android/iOS JavaScript exports. `.github/workflows/eas-update.yml` only publishes when manually dispatched and affirmatively approved. Neither workflow signs APK/AABs, deploys Render services, nor exercises device hardware. Authentication, payment and group limits currently use the backend process's in-memory express-rate-limit store; stay on one API instance or configure a shared store before scaling horizontally.

## Backup and recovery

- Enable provider backups before storing live outlet data. Document backup cadence, retention, recovery owner and target recovery time.
- Before any index/schema migration, review impact, back up and test restore. No destructive migration is included in this change.
- Keep order item snapshots, catalogue and order records; never run development seed/reset scripts against staging/production.
- Follow owner-approved retention for payment verification records; never store card credentials in Wrapchik.
- A hosted-catalogue import remains blocked until the source inventory is available and you explicitly approve the catalogue-only copy. No database records were changed.

Before a production release, review the non-destructive additive index previews (`npm run db:query-indexes` and `npm run db:loyalty-indexes`) against the intended database. Apply only to the target database after the duplicate/conflict checks pass. Production Mongoose auto-indexing is disabled; no collection is dropped or reseeded by these scripts.

### Compressed backup and isolated restore

Install MongoDB Database Tools (`mongodump`, `mongorestore`) and `mongosh` on the machine performing recovery. Set `MONGO_URI` in `backend/.env` to the source database; do not paste it into a ticket or shell history. From PowerShell:

```powershell
Set-Location 'C:\path\to\wrapchik\backend'
npm run db:backup
```

The script writes a timestamped compressed archive under `backend/backups/`, which is excluded from source control. Copy the archive to encrypted storage with access limited to the recovery owner.

Restore first previews into a **new, empty database name** on the same MongoDB deployment (the destination must differ from the source):

```powershell
npm run db:restore -- --archive 'C:\secure-backups\wrapchik-2026-11-20.archive.gz' --target wrapchik_restore_check
```

After reviewing the source/destination printed by the script, explicitly apply:

```powershell
npm run db:restore -- --archive 'C:\secure-backups\wrapchik-2026-11-20.archive.gz' --target wrapchik_restore_check --apply
```

The restore script refuses to run if it cannot confirm the destination is empty and never uses `--drop`. Validate the restored data and application against that separate database before switching any application connection string. These scripts do not configure Atlas backups or replace an owner-approved retention/restore rehearsal.
