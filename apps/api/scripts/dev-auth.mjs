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
import { generateKeyPair, exportJWK, SignJWT } from 'jose';

// Dev convenience: log request-handling errors instead of dying — a crashed
// issuer silently breaks the web app's one-click sign-in.
process.on('uncaughtException', (err) => console.error('[dev-auth] error:', err));
process.on('unhandledRejection', (err) => console.error('[dev-auth] rejection:', err));

const PORT = 3999;
const ISSUER = `http://localhost:${PORT}/`;
const AUDIENCE = 'splitsmart-api';

const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwk = await exportJWK(publicKey);
jwk.kid = 'dev-key-1';
jwk.alg = 'RS256';
jwk.use = 'sig';

async function mint(sub, email, name) {
  return new SignJWT({ email, name })
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

    // GET /token                          → list the demo users (name + email)
    // GET /token?user=maya                → a signed token for a demo user
    // GET /token?email=you@x.com&name=You → a signed token for that identity
    //   (the API creates the account on first request — email sign-in for dev)
    if (url.pathname === '/token') {
      const wanted = url.searchParams.get('user');
      const email = url.searchParams.get('email')?.trim().toLowerCase();

      if (email !== undefined) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid email' }));
          return;
        }
        const name = url.searchParams.get('name')?.trim() || email.split('@')[0];
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
