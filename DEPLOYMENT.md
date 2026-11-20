# Wrapchik Deployment Guide

Nothing was deployed or published. Keep development, staging and production databases and credentials separate.

## Suggested hosting shape

- **Client:** Expo EAS builds. The app identifier and EAS project ID are already configured in the frontend.
- **API:** a managed Node host with persistent Express + Socket.IO support, TLS, health checks, environment secrets, logs and reliable uptime. Render is one prototype option, but its free services can suspend and its documentation says free instances are not for production. Use paid always-on compute for outlet operations.
- **Database:** MongoDB Atlas. M0 is a small development/proof-of-concept tier (512 MB shared cluster); choose a paid tier and backups suitable for the outlet before launch.
- **Images:** existing catalogue URLs remain. Campaign banners accept already-hosted HTTPS Cloudinary URLs; upload is performed through Cloudinary's own console. No Cloudinary API credential or direct upload endpoint is present in this codebase, and customer functionality does not require Cloudinary for ordinary ordering.
- **Payments:** New orders use cash at counter or outlet-configured UPI with manual administrator verification. Legacy gateway records remain supported for historical orders.
- **Push:** configure Expo project and Android Firebase credentials for EAS builds, then verify delivery on a real test device.

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

`GET /health` returns HTTP 200 only while MongoDB is connected and HTTP 503 otherwise. Set production `CORS_ORIGIN` to comma-separated, exact browser origins (for example `https://wrapchik.example,https://admin.wrapchik.example`); production refuses an empty value or `*`. Native Android/iOS requests do not use browser CORS, but web origins must be listed.

### Campus directions

The outlet directions control opens a free Google Maps URL on Android, iOS, and web using the pickup location from public outlet settings (with a TIET SAC fallback). No embedded map tiles, paid maps SDK, API key or GPS permission is required; verify the outlet pin and label with the campus before publishing a customer-facing address.

## Staging

- Create a separate Atlas database and service credentials.
- Deploy the API behind HTTPS. Set exact `CORS_ORIGIN`, `TRUST_PROXY_HOPS` to the reverse-proxy hop count, a random `JWT_SECRET`, and backend email SMTP settings. Keep all private credentials in the backend host’s secret manager.
- Set the Expo staging environment’s `EXPO_PUBLIC_API_URL` to the HTTPS API URL. Never put private keys in Expo public variables.
- Verify cash and UPI workflows using clearly identified staging data; keep UPI payment pending until an administrator verifies actual receipt.

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
Set-Location 'C:\path\to\wrapchik\frontend'
eas build --platform android --profile preview
eas build --platform android --profile production
```

`preview` creates an internally distributed Android APK; `production` creates the Android release bundle. The current app validates missing, placeholder, loopback and non-HTTPS API URLs before preview/production builds. Build credentials, Google OAuth clients and the actual deployed API are external setup and are not verified by a JavaScript export. The development APK command is `eas build --platform android --profile development`.

## Automated CI and rate limits

`.github/workflows/ci.yml` runs clean lockfile installs, backend/frontend tests, route checks, Expo dependency compatibility and web/Android JavaScript exports. It does not make signed APK/AABs, deploy services or exercise Android hardware. Authentication, payment and group limits currently use the backend process's in-memory express-rate-limit store; run one API instance or configure a shared store before scaling horizontally.

## Backup and recovery

- Enable provider backups before storing live outlet data. Document backup cadence, retention, recovery owner and target recovery time.
- Before any index/schema migration, review impact, back up and test restore. No destructive migration is included in this change.
- Keep order item snapshots, catalogue and order records; never run development seed/reset scripts against staging/production.
- Follow owner-approved retention for payment verification records; never store card credentials in Wrapchik.

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
