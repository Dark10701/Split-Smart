import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Friendship, User } from '@prisma/client';
import { normalizePhoneInput } from '@splitsmart/validation';
import { PrismaService } from '../database/prisma.service';

/** What we expose about another user — never authSubject. */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  upiId: string | null;
  avatarColor: string | null;
}

/** A search hit annotated with how the caller relates to that user. */
export interface FriendSearchHit extends PublicUser {
  relationship: 'none' | 'friends' | 'request_sent' | 'request_received' | 'blocked';
}

export interface FriendsOverview {
  friends: PublicUser[];
  /** Requests waiting on MY answer. */
  incoming: Array<{ friendshipId: string; user: PublicUser }>;
  /** Requests I sent that they haven't answered. */
  outgoing: Array<{ friendshipId: string; user: PublicUser }>;
  /** Users I have blocked. */
  blocked: PublicUser[];
}

function toPublic(u: User): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    upiId: u.upiId,
    avatarColor: u.avatarColor,
  };
}

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The edge between two users in either direction, if any. */
  private async edge(a: string, b: string): Promise<Friendship | null> {
    return this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: a, addresseeId: b },
          { requesterId: b, addresseeId: a },
        ],
      },
    });
  }

  /**
   * Search people by mobile number, email, or name. Phone/email must match
   * exactly (privacy: no fishing for numbers by prefix); names match by
   * fragment. The caller is excluded; users who blocked the caller are hidden.
   */
  async search(meId: string, q: string): Promise<FriendSearchHit[]> {
    const phone = normalizePhoneInput(q);
    const looksLikeEmail = q.includes('@');
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: meId },
        OR: [
          ...(phone ? [{ phone }] : []),
          ...(looksLikeEmail ? [{ email: q.trim().toLowerCase() }] : []),
          ...(!phone && !looksLikeEmail
            ? [{ name: { contains: q.trim(), mode: 'insensitive' as const } }]
            : []),
        ],
      },
      take: 10,
      orderBy: { name: 'asc' },
    });
    if (users.length === 0) return [];

    const edges = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: meId, addresseeId: { in: users.map((u) => u.id) } },
          { addresseeId: meId, requesterId: { in: users.map((u) => u.id) } },
        ],
      },
    });
    const hits: FriendSearchHit[] = [];
    for (const u of users) {
      const e = edges.find((x) => x.requesterId === u.id || x.addresseeId === u.id);
      let relationship: FriendSearchHit['relationship'] = 'none';
      if (e) {
        if (e.status === 'accepted') relationship = 'friends';
        else if (e.status === 'blocked') {
          // I blocked them → show as blocked; they blocked me → hide entirely.
          if (e.requesterId === meId) relationship = 'blocked';
          else continue;
        } else relationship = e.requesterId === meId ? 'request_sent' : 'request_received';
      }
      hits.push({ ...toPublic(u), relationship });
    }
    return hits;
  }

  /** Full relationship overview for the Friends screen. */
  async overview(meId: string): Promise<FriendsOverview> {
    const edges = await this.prisma.friendship.findMany({
      where: { OR: [{ requesterId: meId }, { addresseeId: meId }] },
      include: { requester: true, addressee: true },
    });
    const out: FriendsOverview = { friends: [], incoming: [], outgoing: [], blocked: [] };
    for (const e of edges) {
      const other = e.requesterId === meId ? e.addressee : e.requester;
      if (e.status === 'accepted') out.friends.push(toPublic(other));
      else if (e.status === 'pending') {
        if (e.addresseeId === meId)
          out.incoming.push({ friendshipId: e.id, user: toPublic(other) });
        else out.outgoing.push({ friendshipId: e.id, user: toPublic(other) });
      } else if (e.status === 'blocked' && e.requesterId === meId) {
        out.blocked.push(toPublic(other));
      }
    }
    out.friends.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }

  /** Send (or auto-accept a crossing) friend request. Idempotent. */
  async sendRequest(meId: string, targetId: string): Promise<Friendship> {
    if (meId === targetId) throw new BadRequestException('You cannot add yourself');
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('User not found');

    const existing = await this.edge(meId, targetId);
    if (existing) {
      if (existing.status === 'accepted') {
        throw new ConflictException('You are already friends');
      }
      if (existing.status === 'blocked') {
        throw new ForbiddenException('This user cannot be added');
      }
      // pending: mine → idempotent no-op; theirs → both want it, accept.
      if (existing.requesterId === meId) return existing;
      return this.prisma.friendship.update({
        where: { id: existing.id },
        data: { status: 'accepted' },
      });
    }
    return this.prisma.friendship.create({
      data: { requesterId: meId, addresseeId: targetId },
    });
  }

  /** Accept or reject a request addressed to me. Reject deletes the edge. */
  async respond(meId: string, friendshipId: string, accept: boolean): Promise<{ ok: true }> {
    const edge = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!edge || edge.addresseeId !== meId || edge.status !== 'pending') {
      throw new NotFoundException('No such pending request');
    }
    if (accept) {
      await this.prisma.friendship.update({
        where: { id: friendshipId },
        data: { status: 'accepted' },
      });
    } else {
      await this.prisma.friendship.delete({ where: { id: friendshipId } });
    }
    return { ok: true };
  }

  /** Remove a friend, or cancel my own outgoing pending request. */
  async remove(meId: string, otherUserId: string): Promise<{ ok: true }> {
    const edge = await this.edge(meId, otherUserId);
    const cancellable =
      edge &&
      (edge.status === 'accepted' || (edge.status === 'pending' && edge.requesterId === meId));
    if (!cancellable) throw new NotFoundException('No friendship with this user');
    await this.prisma.friendship.delete({ where: { id: edge.id } });
    return { ok: true };
  }

  /** Block a user: replaces any existing edge with a blocked edge owned by me. */
  async block(meId: string, otherUserId: string): Promise<{ ok: true }> {
    if (meId === otherUserId) throw new BadRequestException('You cannot block yourself');
    const target = await this.prisma.user.findUnique({ where: { id: otherUserId } });
    if (!target) throw new NotFoundException('User not found');
    const existing = await this.edge(meId, otherUserId);
    if (existing) await this.prisma.friendship.delete({ where: { id: existing.id } });
    await this.prisma.friendship.create({
      data: { requesterId: meId, addresseeId: otherUserId, status: 'blocked' },
    });
    return { ok: true };
  }

  /** Unblock: only the blocker can lift their own block. */
  async unblock(meId: string, otherUserId: string): Promise<{ ok: true }> {
    const edge = await this.prisma.friendship.findFirst({
      where: { requesterId: meId, addresseeId: otherUserId, status: 'blocked' },
    });
    if (!edge) throw new NotFoundException('You have not blocked this user');
    await this.prisma.friendship.delete({ where: { id: edge.id } });
    return { ok: true };
  }
}
