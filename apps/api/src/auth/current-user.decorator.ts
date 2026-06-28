import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthClaims } from '@splitsmart/validation';

/** Injects the verified token claims attached by JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthClaims => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthClaims }>();
    if (!request.user) {
      throw new Error('CurrentUser used without JwtAuthGuard');
    }
    return request.user;
  },
);
