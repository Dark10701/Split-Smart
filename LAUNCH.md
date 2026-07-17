# SplitSmart — Production Launch Checklist

A hardcore, repo-specific launch runbook. Every command assumes the current
monorepo layout (`apps/api` NestJS, `apps/mobile` Expo SDK 51, `apps/web`
Next.js, `workers/*` BullMQ, Postgres via Prisma, Redis). Check boxes as you go.

> **🚨 #1 LAUNCH BLOCKER — read first.** Auth is still the local dev stand-in
> `apps/api/scripts/dev-auth.mjs` (scrypt passwords in a gitignored JSON file,
> `:3999`). **This must NOT ship.** The API already validates real OIDC tokens
> (`AUTH_ISSUER_URL` / `AUTH_AUDIENCE` / `AUTH_JWKS_URI`), so going live is a
> *configuration* swap: provision an Auth0 or Clerk tenant, wire the mobile/web
> login to its SDK, point those three env vars at it. Nothing ships until this
> is done. Everything below assumes a real IdP is in place.

---

## 1 · Production Environment Setup (dev → prod switch)

### 1.1 Env file structure (three tiers, only the example is committed)

```
.env.example        # committed — keys only, no values (already exists)
.env                # local dev   — gitignored (already)
.env.staging        # staging     — gitignored, lives in CI/secrets store only
.env.production     # production  — NEVER on disk in prod; injected at runtime
```

Add a per-env guard so a prod process refuses to boot with dev defaults. In
`apps/api/src/main.ts` (bootstrap), before `app.listen`:

```ts
const required = ['DATABASE_URL', 'REDIS_URL', 'AUTH_ISSUER_URL', 'AUTH_AUDIENCE', 'AUTH_JWKS_URI'];
for (const k of required) if (!process.env[k]) throw new Error(`Missing env ${k}`);
if (process.env.NODE_ENV === 'production' && process.env.AUTH_ISSUER_URL!.includes('localhost')) {
  throw new Error('Refusing to start: dev auth issuer in production');
}
```

### 1.2 Secrets — backend (AWS, matches `infra/terraform`)

Do **not** put prod secrets in a file. Store them in **AWS SSM Parameter Store**
(SecureString) or **Secrets Manager**, injected as env at container start.

```bash
# Store (once)
aws ssm put-parameter --name /splitsmart/prod/DATABASE_URL --type SecureString \
  --value 'postgresql://user:pass@prod-db.xxxx.rds.amazonaws.com:5432/splitsmart'
aws ssm put-parameter --name /splitsmart/prod/AUTH_AUDIENCE --type SecureString --value 'splitsmart-api'
# ...repeat for REDIS_URL, AUTH_ISSUER_URL, AUTH_JWKS_URI, SENTRY_DSN

# ECS task definition references them (no plaintext in the image):
#   "secrets": [{ "name": "DATABASE_URL", "valueFrom": "arn:aws:ssm:...:/splitsmart/prod/DATABASE_URL" }]
```

Rotate the JWT/OIDC audience and DB password from the dev values — assume every
dev secret is burned.

### 1.3 Secrets — mobile (Expo/EAS) — **the #1 mobile footgun**

- `EXPO_PUBLIC_*` variables are **baked into the app bundle and are NOT secret** —
  anyone can extract them. `EXPO_PUBLIC_API_URL` is fine (it's a public URL).
  **Never** put an API key, salt, or OAuth *client secret* in an `EXPO_PUBLIC_*`.
- OAuth on mobile uses **PKCE with a public client** → there is no client secret
  on the device. The IdP (Auth0/Clerk) holds the secret server-side.
- Build-time secrets (Play service-account JSON, Apple API key, signing creds)
  go in **EAS secrets**, used only on EAS servers, never in the binary:

```bash
eas secret:create --scope project --name GOOGLE_SERVICE_ACCOUNT_KEY --type file --value ./play-service-account.json
eas secret:list
```

### 1.4 Mandatory backend flips right before launch

| Setting | Dev | **Production** |
|---|---|---|
| `NODE_ENV` | `development` | **`production`** |
| Nest logger | `['log','debug','verbose']` | **`['error','warn','log']`** |
| Migrations | `prisma migrate dev` | **`prisma migrate deploy`** (never `dev`) |
| DB | local Docker Postgres | **RDS instance + automated backups + PITR** |
| Connection pooling | none | **PgBouncer / RDS Proxy (transaction mode)** |
| CORS | `*` | **exact web origin(s) only** |
| Rate limiting | on (`RateLimitModule`) | **on, tuned per-route** |
| HTTP hardening | — | **`helmet()`, `app.set('trust proxy', 1)`, HTTPS-only** |
| Swagger / debug routes | — | **disabled** |

Connection pooling (Prisma + PgBouncer transaction mode) — set on the prod
`DATABASE_URL` and add a direct URL for migrations in `schema.prisma`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")       // ...?pgbouncer=true&connection_limit=1
  directUrl = env("DIRECT_DATABASE_URL") // 5432 direct, for `migrate deploy`
}
```

Release command sequence (CI/CD, run once per deploy, before traffic shifts):

```bash
pnpm --filter @splitsmart/api prisma:generate
DIRECT_DATABASE_URL=$DIRECT pnpm --filter @splitsmart/api exec prisma migrate deploy
# ^ this applies 20260717090000_phone_and_friendships and every prior migration
pnpm --filter @splitsmart/api build && node apps/api/dist/main.js
```

---

## 2 · Multi-User & Concurrency Hardening

### 2.1 DB indexing — audited against the current schema ✅ mostly done

The schema is already covered for the hot paths:
`Expense @@index([groupId, occurredAt])`, `ExpenseSplit @@index([memberId])`,
`GroupMember @@unique([groupId, userId])`, `Payment @@index([groupId, createdAt])`,
`Friendship @@unique([requesterId, addresseeId]) + @@index([addresseeId, status])`.

**Gaps to add before launch** (`friends.service.ts#edge()` queries the pair in
*both* directions; only one direction is a prefix of an existing index):

```prisma
model Friendship {
  // ...existing...
  @@index([requesterId, status])   // ADD — covers the reverse-direction lookup
}
```

Verify no full-table scans on prod-sized data:

```sql
EXPLAIN ANALYZE SELECT * FROM "Friendship"
  WHERE ("requesterId" = $1 AND "addresseeId" = $2)
     OR ("requesterId" = $2 AND "addresseeId" = $1);
-- want: Index Scan, not Seq Scan
```

### 2.2 N+1 audit — **one real offender, fix it**

Client-side N+1 in `apps/web/app/friends/page.tsx` and `apps/web/app/groups/page.tsx`
(and the mobile equivalents): they do `groups.map(g => getGroup(g) + getBalances(g))`
— **1 + 2N HTTP round-trips** for N groups. At 20 groups that's 41 requests per
screen open. Fix with a single batched endpoint:

```
GET /me/dashboard  →  { groups: [{ id, name, myNet }], overallNet }
```

Compute server-side in one query pass (the balance engine is already pure). This
collapses 41 requests → 1 and is the single biggest latency win for launch.

Backend itself: audit every `prisma.*.findMany` inside a `.map`/loop — none in
`friends.service.ts` (it batches with `in:` lists ✅) or the balance engine.

### 2.3 Race conditions — audit these three

| Risk | Status in this codebase | Action |
|---|---|---|
| **Duplicate settlement/payment** | **Guarded** — `Payment.idempotencyKey @unique`, clients send a key | Verify the mobile settle flow sends a fresh key per attempt |
| **Concurrent expense edits** (lost update) | **Guarded** — `Expense.version` + optimistic concurrency in the update schema | Keep; ensure mobile passes `version` |
| **Profile/phone overwrite** | Partially — `phone @unique` throws on collision (handled as 409) | ✅ handled in `users.service.ts` |
| **Friend-request double-send** | **Guarded** — `@@unique([requesterId, addresseeId])` + auto-accept on crossing | ✅ |

The pattern to enforce everywhere money changes: **DB unique constraint or
`SELECT ... FOR UPDATE` inside a `prisma.$transaction`**, never read-modify-write
in app code. Grep for risk:

```bash
grep -rn "findUnique\|findFirst" apps/api/src --include=*.ts | grep -v spec  # then check each isn't followed by an unguarded update
```

### 2.4 Load test — 100 concurrent users (k6)

```bash
# install: https://k6.io/docs/get-started/installation/  (choco install k6)
cat > loadtest.js <<'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
const BASE = __ENV.BASE || 'https://staging-api.splitsmart.app';
const TOKEN = __ENV.TOKEN; // a valid bearer for a seeded staging user
export const options = {
  stages: [
    { duration: '30s', target: 100 }, // ramp to 100 VUs
    { duration: '2m',  target: 100 }, // hold
    { duration: '30s', target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_failed:   ['rate<0.01'],           // <1% errors
    http_req_duration: ['p(95)<400', 'p(99)<800'], // p95 < 400ms
  },
};
const h = { headers: { Authorization: `Bearer ${TOKEN}` } };
export default function () {
  check(http.get(`${BASE}/me`, h),      { 'me 200': r => r.status === 200 });
  check(http.get(`${BASE}/groups`, h),  { 'groups 200': r => r.status === 200 });
  check(http.get(`${BASE}/friends`, h), { 'friends 200': r => r.status === 200 });
  sleep(1);
}
EOF
BASE=https://staging-api.splitsmart.app TOKEN=eyJ... k6 run loadtest.js
```

**Watch:** `http_req_duration p(95)/p(99)`, `http_req_failed` rate, and on the
server side — DB **active connections** (must not hit the pool ceiling → that's
your pooling proof), CPU, and Redis latency. If p99 balloons while p50 stays
flat, you have a connection-pool or lock-contention problem, not raw compute.

---

## 3 · Release Build & Signing (Expo → EAS is the path)

`apps/mobile` is **managed Expo SDK 51**; the build script is already
`echo "mobile is built via EAS"`. Use EAS Build — it manages the Keystore and
iOS certificates for you (recommended). Raw commands the user asked for are in
§3.4 for the bare/prebuild path.

### 3.1 One-time setup

```bash
npm i -g eas-cli
cd apps/mobile
eas login
eas build:configure          # creates eas.json with build profiles
```

Minimal `apps/mobile/eas.json`:

```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "production": {
      "android": { "buildType": "app-bundle" },
      "ios": { "autoIncrement": true },
      "env": { "EXPO_PUBLIC_API_URL": "https://api.splitsmart.app" }
    },
    "staging": {
      "distribution": "internal",
      "env": { "EXPO_PUBLIC_API_URL": "https://staging-api.splitsmart.app" }
    }
  },
  "submit": { "production": {} }
}
```

### 3.2 Version bump (do this every release) — `apps/mobile/app.config.ts`

Currently `version: '0.0.0'` — **bump before first submit**:

```ts
version: '1.0.0',                 // user-facing (CFBundleShortVersionString / versionName)
ios:     { buildNumber: '1', bundleIdentifier: 'com.splitsmart.app' },
android: { versionCode: 1,   package: 'com.splitsmart.app' },
```

`versionCode` (Android) and `buildNumber` (iOS) **must strictly increase** every
upload or the stores reject it. `eas.json`'s `autoIncrement` handles iOS for you.

### 3.3 Build & submit

```bash
# Android App Bundle (.aab — required by Play), managed Keystore:
eas build --platform android --profile production
eas credentials   # inspect/back up the Keystore EAS generated (KEEP THE BACKUP)

# iOS (needs Apple Developer account; EAS handles cert + provisioning profile):
eas build --platform ios --profile production

# Submit straight to the consoles:
eas submit -p android --latest    # needs the Play service-account JSON (EAS secret)
eas submit -p ios --latest        # needs App Store Connect API key
```

### 3.4 Raw signing (only if you `expo prebuild` to bare native)

```bash
# Android Keystore — BACK THIS FILE UP; losing it means you can never update the app
keytool -genkeypair -v -keystore splitsmart-upload.keystore \
  -alias splitsmart -keyalg RSA -keysize 2048 -validity 10000
# put the passwords in android/gradle.properties (gitignored), reference in android/app/build.gradle signingConfigs.release
```

iOS distribution cert + provisioning profile: Xcode → Settings → Accounts → your
team → **Manage Certificates → + → Apple Distribution**; profiles auto-generate
on Archive, or via `eas credentials`.

### 3.5 Shrinking / optimization

- **Android R8/ProGuard** (managed Expo): add `expo-build-properties`:

```bash
npx expo install expo-build-properties
```
```ts
// app.config.ts plugins:
plugins: [['expo-build-properties', {
  android: { enableProguardInReleaseBuilds: true, enableShrinkResources: true }
}]]
```
Then **test a release build on a device** — R8 can strip reflection-based deps.
If a screen crashes only in release, add keep-rules to
`android/app/proguard-rules.pro` (e.g. `-keep class com.yourdep.** { *; }`).

- **iOS bitcode: do nothing.** Apple **removed bitcode** in Xcode 14+; the App
  Store no longer accepts or needs it. Leave it off. (Correcting the ask — enabling
  it would fail the build.)

---

## 4 · Final Smoke Test — Top 10 (physical device, before submit)

Run on **one real Android + one real iPhone**, on cellular (not just Wi-Fi):

1. **Cold start → login** with a real IdP account (email + password *and* mobile + password); wrong password shows the error, not a crash.
2. **Register** a new account end-to-end (name, email, mobile, password, OTP) → lands in-app; duplicate phone/email rejected with a clear message.
3. **Offline → online**: enable airplane mode mid-session, add an expense, re-enable — no data loss, no duplicate on the retry (idempotency holds).
4. **Add expense + settle**: create group, add expense, "Pay via UPI" **actually opens GPay/PhonePe** with the right VPA + amount; record settlement updates balances.
5. **My UPI**: QR renders, Download saves a PNG, Share opens the OS sheet.
6. **Friend request** round-trip on two devices: send → the other accepts → both see the friendship; block hides the user.
7. **Deep linking**: open `splitsmart://` link (invite) from outside the app → routes to the right screen when cold and when backgrounded.
8. **Permission denial**: deny notifications/camera when asked → app stays usable, no crash, sensible fallback copy.
9. **Push notification** received in background → tapping it opens the correct screen. *(Note: `expo-notifications` is not yet installed — wire it or remove the notification-prefs promise from the store listing.)*
10. **Rotate / background / kill-and-restore**: session survives; no white screen; balances reload.

### 4.1 Automated pre-launch gates

```bash
# Google Play Pre-launch report: upload the .aab to the Internal testing track,
# Play runs it on real devices (Firebase Test Lab). Read the report for:
#   - Crashes  → fix ALL before production rollout
#   - ANRs     → any main-thread block > 5s; usually a sync network/DB call on UI thread
#   - Accessibility & performance warnings → triage

# Firebase Test Lab robo test locally against a build:
gcloud firebase test android run --type robo \
  --app app-release.aab --timeout 300s --device model=redfin,version=30
```

Interpretation: **ANR = main thread blocked > 5s.** In an Expo/RN app the usual
cause is a synchronous bridge/native call or an unbounded `await` on the JS
thread during navigation — move it off the interaction (`InteractionManager`,
or fetch after mount). Prioritize by **impacted-session count**, fix crashes
before ANRs before jank.

---

## 5 · Post-Launch Monitoring — Day-1 essential alerts

The API is **already instrumented** (README §Observability: OpenTelemetry,
`SENTRY_DSN` hook, `GET /metrics` Prometheus). Turn it on and add mobile Sentry.

```bash
# Mobile crash reporting (not yet installed):
cd apps/mobile && npx expo install @sentry/react-native
# wrap the root component with Sentry.wrap(); set dsn from a non-secret EXPO_PUBLIC_SENTRY_DSN
```

Set these **five alerts** on Day 1 (Sentry + your metrics stack / Firebase):

| Alert | Threshold | Tool |
|---|---|---|
| **Crash-free users** | < **99.0%** → page | Sentry (mobile) / Firebase Crashlytics |
| **API 5xx rate** | > **1%** over 5 min → page | Sentry (API) / Prometheus on `/metrics` |
| **API latency p95** | > **800ms** over 10 min → warn | Prometheus histogram from `/metrics` |
| **Login/auth failure rate** | > **20%** over 10 min → page (IdP outage) | Auth0/Clerk dashboard + API 401 counter |
| **DB connections** | > **80%** of pool → page | RDS CloudWatch / PgBouncer stats |

Also wire **release health** in Sentry (tag events with the `version` from
`app.config.ts`) so a bad release is obvious within minutes, and keep the EAS
**staged rollout** at 10% → 50% → 100% over 48h so a spike in crash-free rate
halts the rollout automatically.

---

## Launch-day go/no-go (one screen)

- [ ] Real IdP live; dev-auth issuer unreachable from prod (§blocker, §1.1)
- [ ] All secrets rotated off dev values, in SSM/EAS (§1.2, §1.3)
- [ ] `prisma migrate deploy` run on prod DB; backups + PITR on (§1.4)
- [ ] PgBouncer/RDS Proxy in front of Postgres, `directUrl` set (§1.4)
- [ ] `/me/dashboard` batched endpoint shipped (kills the N+1) (§2.2)
- [ ] `Friendship @@index([requesterId, status])` added (§2.1)
- [ ] k6 100-VU run green: p95 < 400ms, errors < 1% (§2.4)
- [ ] version bumped to 1.0.0 / versionCode 1 / buildNumber 1 (§3.2)
- [ ] Release build tested on device with R8 on (§3.5)
- [ ] Top-10 smoke test passed on real Android + iPhone (§4)
- [ ] Play Pre-launch report: 0 crashes, 0 ANRs (§4.1)
- [ ] 5 Day-1 alerts armed and test-fired (§5)
