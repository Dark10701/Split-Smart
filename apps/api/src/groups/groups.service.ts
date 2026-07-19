import {
  Injectable,
  Optional,
  Inject,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Group, GroupMember, Prisma } from '@prisma/client';
import type { CreateGroupInput, AddMemberInput } from '@splitsmart/validation';
import { PrismaService } from '../database/prisma.service';
import { generateInviteToken, isInviteUsable } from './invite';
import { INVITE_NOTIFIER, type InviteNotifier } from '../queue/invite-notifier';

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(INVITE_NOTIFIER) private readonly notifier?: InviteNotifier,
  ) {}

  /** Create a group and add the creator as its first admin, atomically. */
  async create(creatorUserId: string, input: CreateGroupInput): Promise<Group> {
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          name: input.name,
          defaultCurrency: input.defaultCurrency ?? 'INR',
          createdById: creatorUserId,
        },
      });
      await tx.groupMember.create({
        data: { groupId: group.id, userId: creatorUserId, role: 'admin' },
      });
      return group;
    });
  }

  async listForUser(userId: string): Promise<Group[]> {
    return this.prisma.group.findMany({
      where: { members: { some: { userId, removedAt: null } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(groupId: string): Promise<Group> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          where: { removedAt: null },
          // Expose only what members need of each other: display name and the
          // UPI VPA for settle-up. Never the email or auth subject.
          include: { user: { select: { name: true, upiId: true, avatarColor: true } } },
        },
      },
    });
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  /** Active membership of a user in a group, or null. Used by the guard. */
  async getMembership(groupId: string, userId: string): Promise<GroupMember | null> {
    return this.prisma.groupMember.findFirst({ where: { groupId, userId, removedAt: null } });
  }

  /**
   * Shareable link invites are permanent per group: the same token is reused
   * so the group's invite link never breaks. Targeted email invites stay
   * one-per-call (they get consumed on accept).
   */
  async createInvite(groupId: string, email?: string): Promise<{ token: string }> {
    if (!email) {
      const existing = await this.prisma.invitation.findFirst({
        where: { groupId, email: null, acceptedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (existing && isInviteUsable(existing)) return { token: existing.token };
    }
    const token = generateInviteToken();
    await this.prisma.invitation.create({ data: { groupId, token, email: email ?? null } });
    if (email) {
      await this.notifier?.sendInvite({ email, token, groupId });
    }
    return { token };
  }

  /** What a join link points at, for the "Join group?" screen. */
  async getInvitePreview(
    token: string,
    userId: string,
  ): Promise<{ groupId: string; groupName: string; memberCount: number; alreadyMember: boolean }> {
    const inv = await this.prisma.invitation.findUnique({
      where: { token },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            _count: { select: { members: { where: { removedAt: null } } } },
          },
        },
      },
    });
    if (!inv || !isInviteUsable(inv)) {
      throw new BadRequestException('Invalid or expired invitation');
    }
    return {
      groupId: inv.group.id,
      groupName: inv.group.name,
      memberCount: inv.group._count.members,
      alreadyMember: Boolean(await this.getMembership(inv.groupId, userId)),
    };
  }

  async join(userId: string, token: string): Promise<GroupMember> {
    const inv = await this.prisma.invitation.findUnique({ where: { token } });
    if (!inv || !isInviteUsable(inv))
      throw new BadRequestException('Invalid or expired invitation');
    if (await this.getMembership(inv.groupId, userId)) {
      throw new ConflictException('Already a member of this group');
    }
    // Shareable link invites (no email) stay open so the link keeps working;
    // targeted email invites are single-use and get consumed here.
    const ops: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.groupMember.create({ data: { groupId: inv.groupId, userId, role: 'member' } }),
    ];
    if (inv.email) {
      ops.push(
        this.prisma.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } }),
      );
    }
    const [member] = await this.prisma.$transaction(ops);
    return member as GroupMember;
  }

  /** Admin-only: add an existing user (by email) or a guest (by name). */
  async addMember(groupId: string, input: AddMemberInput): Promise<GroupMember> {
    if (input.guestName) {
      return this.prisma.groupMember.create({
        data: { groupId, guestName: input.guestName, role: input.role },
      });
    }
    const user = await this.prisma.user.findUnique({
      where: { email: input.email!.toLowerCase() },
    });
    if (!user) throw new NotFoundException('No account with that email; send an invite instead');
    if (await this.getMembership(groupId, user.id)) {
      throw new ConflictException('Already a member of this group');
    }
    return this.prisma.groupMember.create({ data: { groupId, userId: user.id, role: input.role } });
  }

  /** Admin-only: soft-remove a member (history is preserved). */
  async removeMember(groupId: string, memberId: string): Promise<GroupMember> {
    const member = await this.prisma.groupMember.findFirst({ where: { id: memberId, groupId } });
    if (!member) throw new NotFoundException('Member not found');
    return this.prisma.groupMember.update({
      where: { id: memberId },
      data: { removedAt: new Date() },
    });
  }
}
