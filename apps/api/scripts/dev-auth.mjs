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
  .createServer((req, res) => {
    if (req.url === '/jwks.json') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    res.writeHead(404);
    res.end();
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
