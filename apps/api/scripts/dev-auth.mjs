/**
 * Local development auth helper — NOT FOR PRODUCTION.
 *
 * SplitSmart's API validates OIDC JWTs (issuer + audience + JWKS signature).
 * Rather than provision a real Auth0/Clerk tenant just to click around locally,
 * this script stands in for the identity provider:
 *
 *   1. generates an RS256 keypair in memory,
 *   2. serves a JWKS document at http://localhost:3999/jwks.json,
 *   3. prints a signed bearer token for a couple of dev users.
 *
 * Point the API at it with these .env values, then paste a printed token into
 * the web app's "Sign in" box (or use it as `Authorization: Bearer <token>`):
 *
 *   AUTH_JWKS_URI=http://localhost:3999/jwks.json
 *   AUTH_ISSUER_URL=http://localhost:3999/
 *   AUTH_AUDIENCE=splitsmart-api
 *
 * Run from the repo root:  pnpm --filter @splitsmart/api dev:auth
 */
import http from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateKeyPair, exportJWK, importJWK, SignJWT } from 'jose';

// Dev convenience: log request-handling errors instead of dying — a crashed
// issuer silently breaks the web app's one-click sign-in.
process.on('uncaughtException', (err) => console.error('[dev-auth] error:', err));
process.on('unhandledRejection', (err) => console.error('[dev-auth] rejection:', err));

const PORT = 3999;
const ISSUER = `http://localhost:${PORT}/`;
const AUDIENCE = 'splitsmart-api';

// Persist the keypair across restarts (dev-only, gitignored). Otherwise every
// restart mints a new key and all previously issued tokens turn into 401s —
// the app then looks "broken" for anyone still holding a session cookie.
const KEY_FILE = fileURLToPath(new URL('./.dev-auth-key.json', import.meta.url));
let privateKey;
let jwk;
try {
  const saved = JSON.parse(readFileSync(KEY_FILE, 'utf8'));
  privateKey = await importJWK(saved.privateJwk, 'RS256');
  jwk = saved.publicJwk;
} catch {
  const pair = await generateKeyPair('RS256', { extractable: true });
  privateKey = pair.privateKey;
  jwk = await exportJWK(pair.publicKey);
  jwk.kid = 'dev-key-1';
  jwk.alg = 'RS256';
  jwk.use = 'sig';
  writeFileSync(
    KEY_FILE,
    JSON.stringify({ privateJwk: await exportJWK(pair.privateKey), publicJwk: jwk }, null, 2),
  );
}

async function mint(sub, email, name) {
  // email_verified is only ever set on tokens minted AFTER the user proved
  // ownership (OTP flow below) or for the pre-verified demo users — the API
  // rejects tokens without it.
  return new SignJWT({ email, name, email_verified: true })
    .setProtectedHeader({ alg: 'RS256', kid: 'dev-key-1' })
    .setSubject(sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(privateKey);
}

const users = [
  { sub: 'dev|maya', email: 'maya@example.in', name: 'Maya' },
  { sub: 'dev|ravi', email: 'ravi@example.in', name: 'Ravi' },
];

// ---------------------------------------------------------------------------
// Email verification (OTP). In production this is the OIDC provider's job —
// locally we mimic the shape: request a code, prove ownership, get a token.
// There is no real mail sender in dev, so the "email" is the issuer console
// (and `devCode` in the response so the local UI can hint it).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
/** email → { code, name, expiresAt, attempts } */
const otps = new Map();

function requestOtp(email, name) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  otps.set(email, { code, name, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });
  console.log(`\n📧 Verification code for ${email}: ${code}  (valid 10 minutes)\n`);
  return code;
}

/** Consumes the code on success. Returns { name } on success, { error } otherwise. */
function verifyOtp(email, code) {
  const entry = otps.get(email);
  if (!entry) return { error: 'No code was requested for this email — request one first.' };
  if (Date.now() > entry.expiresAt) {
    otps.delete(email);
    return { error: 'That code has expired — request a new one.' };
  }
  entry.attempts += 1;
  if (entry.attempts > OTP_MAX_ATTEMPTS) {
    otps.delete(email);
    return { error: 'Too many attempts — request a new code.' };
  }
  if (entry.code !== code) return { error: 'That code is not right — check and try again.' };
  otps.delete(email);
  return { name: entry.name };
}

http
  .createServer(async (req, res) => {
    // Dev-only: let the local web app fetch a token instead of hand-pasting one.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, ISSUER);

    if (url.pathname === '/jwks.json') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ keys: [jwk] }));
      return;
    }

    // GET /otp/request?email=&name= → generate a verification code for the
    // email. The "email delivery" in dev is the issuer console; devCode is
    // also returned so the local UI can hint it (never do this in production).
    if (url.pathname === '/otp/request') {
      const email = url.searchParams.get('email')?.trim().toLowerCase() ?? '';
      if (!EMAIL_RE.test(email)) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid email' }));
        return;
      }
      const name = url.searchParams.get('name')?.trim() || email.split('@')[0];
      const code = requestOtp(email, name);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ sent: true, email, devCode: code }));
      return;
    }

    // GET /token                            → list the demo users (name + email)
    // GET /token?user=maya                   → a signed token for a demo user
    // GET /token?email=you@x.com&code=123456 → verify the OTP, then a signed
    //   token for that identity (the API creates the account on first request)
    if (url.pathname === '/token') {
      const wanted = url.searchParams.get('user');
      const email = url.searchParams.get('email')?.trim().toLowerCase();

      if (email !== undefined) {
        // Email sign-in requires a verified OTP code (see /otp/request).
        const result = verifyOtp(email, url.searchParams.get('code') ?? '');
        if (result.error) {
          res.writeHead(401, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: result.error }));
          return;
        }
        const name = result.name || email.split('@')[0];
        const token = await mint(`dev|${email}`, email, name);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ token, name, email }));
        return;
      }

      if (!wanted) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(users.map(({ sub, email, name }) => ({ sub, email, name }))));
        return;
      }
      const user = users.find(
        (u) => u.sub === wanted || u.name.toLowerCase() === wanted.toLowerCase(),
      );
      if (!user) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: `unknown dev user "${wanted}"` }));
        return;
      }
      const token = await mint(user.sub, user.email, user.name);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ token, name: user.name, email: user.email }));
      return;
    }

    res.writeHead(404);
    res.end();
  })
  .on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\nPort ${PORT} is already in use — another dev-auth is probably running.` +
          `\nEither keep using that one, or free the port and retry:` +
          `\n  PowerShell:  Get-NetTCPConnection -LocalPort ${PORT} | ` +
          `ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }\n`,
      );
      process.exit(1);
    }
    throw err;
  })
  .listen(PORT, async () => {
    console.log(`\nDev auth issuer running — JWKS at ${ISSUER}jwks.json\n`);
    console.log('Add to your .env:');
    console.log(`  AUTH_JWKS_URI=${ISSUER}jwks.json`);
    console.log(`  AUTH_ISSUER_URL=${ISSUER}`);
    console.log(`  AUTH_AUDIENCE=${AUDIENCE}\n`);
    for (const u of users) {
      const token = await mint(u.sub, u.email, u.name);
      console.log(`── ${u.name} <${u.email}> ──\n${token}\n`);
    }
    console.log('Paste a token into the web app "Sign in" box. Tokens last 12h.\n');
    console.log('Leave this process running while you use the app. Ctrl+C to stop.');
  });
