import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthClaims } from '@splitsmart/validation';
import { UsersService } from '../users/users.service';
import { GroupsService } from './groups.service';

interface GuardedRequest {
  user?: AuthClaims;
  params: Record<string, string>;
  membership?: { userId: string; groupId: string; role: string; memberId: string };
}

/** Allows the request only if the caller is an active member of the group. */
@Injectable()
export class GroupMembershipGuard implements CanActivate {
  constructor(
    private readonly users: UsersService,
    private readonly groups: GroupsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<GuardedRequest>();
    if (!req.user) throw new ForbiddenException('Not authenticated');
    const groupId = req.params.id ?? req.params.groupId;
    if (!groupId) throw new ForbiddenException('Group not specified');

    const user = await this.users.resolveFromClaims(req.user);
    const membership = await this.groups.getMembership(groupId, user.id);
    if (!membership) throw new ForbiddenException('Not a member of this group');

    req.membership = { userId: user.id, groupId, role: membership.role, memberId: membership.id };
    return true;
  }
}
