import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export interface Membership {
  userId: string;
  groupId: string;
  role: string;
  memberId: string;
}

/** Injects the membership attached by GroupMembershipGuard. */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Membership => {
    const req = ctx.switchToHttp().getRequest<{ membership?: Membership }>();
    if (!req.membership) throw new Error('CurrentMembership used without GroupMembershipGuard');
    return req.membership;
  },
);
