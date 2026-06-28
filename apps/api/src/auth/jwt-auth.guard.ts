import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { authClaimsSchema } from '@splitsmart/validation';

/**
 * Verifies a Bearer JWT against the OIDC provider's JWKS, checking issuer and
 * audience, then attaches the parsed claims to `request.user`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private jwks?: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly config: ConfigService) {}

  private getJwks(): ReturnType<typeof createRemoteJWKSet> {
    if (!this.jwks) {
      const jwksUri = this.config.get<string>('AUTH_JWKS_URI');
      if (!jwksUri) throw new UnauthorizedException('Auth is not configured (AUTH_JWKS_URI)');
      this.jwks = createRemoteJWKSet(new URL(jwksUri));
    }
    return this.jwks;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: unknown }>();
    const header = request.headers['authorization'] ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    let payload: JWTPayload;
    try {
      const result = await jwtVerify(token, this.getJwks(), {
        issuer: this.config.get<string>('AUTH_ISSUER_URL'),
        audience: this.config.get<string>('AUTH_AUDIENCE'),
      });
      payload = result.payload;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    const claims = authClaimsSchema.safeParse(payload);
    if (!claims.success) {
      throw new UnauthorizedException('Token is missing required claims');
    }
    request.user = claims.data;
    return true;
  }
}
