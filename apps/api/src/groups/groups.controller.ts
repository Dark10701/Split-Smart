import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { Group, GroupMember } from '@prisma/client';
import {
  createGroupSchema,
  addMemberSchema,
  joinGroupSchema,
  type AuthClaims,
} from '@splitsmart/validation';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsersService } from '../users/users.service';
import { GroupsService } from './groups.service';
import { GroupMembershipGuard } from './group-membership.guard';
import { CurrentMembership, type Membership } from './membership.decorator';

type Validatable<T> = {
  safeParse: (
    input: unknown,
  ) => { success: true; data: T } | { success: false; error: { flatten: () => unknown } };
};

function validate<T>(schema: Validatable<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
  return parsed.data;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(
    private readonly groups: GroupsService,
    private readonly users: UsersService,
  ) {}

  @Post('groups')
  async create(@CurrentUser() claims: AuthClaims, @Body() body: unknown): Promise<Group> {
    const input = validate(createGroupSchema, body);
    const user = await this.users.resolveFromClaims(claims);
    return this.groups.create(user.id, input);
  }

  @Get('groups')
  async list(@CurrentUser() claims: AuthClaims): Promise<Group[]> {
    const user = await this.users.resolveFromClaims(claims);
    return this.groups.listForUser(user.id);
  }

  @Get('groups/:id')
  @UseGuards(GroupMembershipGuard)
  async detail(@Param('id') id: string): Promise<Group> {
    return this.groups.getById(id);
  }

  @Post('groups/:id/invite')
  @UseGuards(GroupMembershipGuard)
  async invite(@Param('id') id: string): Promise<{ token: string }> {
    return this.groups.createInvite(id);
  }

  @Post('groups/join')
  async join(@CurrentUser() claims: AuthClaims, @Body() body: unknown): Promise<GroupMember> {
    const { token } = validate(joinGroupSchema, body);
    const user = await this.users.resolveFromClaims(claims);
    return this.groups.join(user.id, token);
  }

  @Post('groups/:id/members')
  @UseGuards(GroupMembershipGuard)
  async addMember(
    @Param('id') id: string,
    @CurrentMembership() membership: Membership,
    @Body() body: unknown,
  ): Promise<GroupMember> {
    if (membership.role !== 'admin') throw new ForbiddenException('Admins only');
    return this.groups.addMember(id, validate(addMemberSchema, body));
  }

  @Delete('groups/:id/members/:memberId')
  @UseGuards(GroupMembershipGuard)
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentMembership() membership: Membership,
  ): Promise<GroupMember> {
    if (membership.role !== 'admin') throw new ForbiddenException('Admins only');
    return this.groups.removeMember(id, memberId);
  }
}
