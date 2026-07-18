import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { BalancesService } from '../balances/balances.service';

export interface DashboardGroup {
  id: string;
  name: string;
  defaultCurrency: string;
  /** This user's net in the group (positive = owed to them). */
  myNetMinor: number;
}

export interface Dashboard {
  /** Sum of the user's nets across groups sharing the primary currency. */
  overallNetMinor: number;
  currency: string;
  groups: DashboardGroup[];
}

/** This user's aggregated balance toward one other person across shared groups. */
export interface FriendBalance {
  /** `user:<userId>` for accounts, `guest:<memberId>` for guests. */
  key: string;
  name: string;
  avatarColor: string | null;
  iOweMinor: number;
  owesMeMinor: number;
  netMinor: number;
  currency: string;
  groups: Array<{ id: string; name: string }>;
}

/**
 * One-shot home-screen payload: the user's groups each annotated with their net
 * balance, plus the overall position. Replaces the client's per-group
 * getGroup + getBalances fan-out (1 + 2N requests) with a single call — one
 * membership query here, then Redis-cached balance reads server-side.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balances: BalancesService,
  ) {}

  async forUser(userId: string): Promise<Dashboard> {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId, removedAt: null },
      include: { group: { select: { id: true, name: true, defaultCurrency: true } } },
      orderBy: { group: { createdAt: 'desc' } },
    });

    const groups = await Promise.all(
      memberships.map(async (m): Promise<DashboardGroup> => {
        const { nets } = await this.balances.getForGroup(m.groupId);
        const myNetMinor = nets[m.group.defaultCurrency]?.[m.id] ?? 0;
        return {
          id: m.group.id,
          name: m.group.name,
          defaultCurrency: m.group.defaultCurrency,
          myNetMinor,
        };
      }),
    );

    const currency = groups[0]?.defaultCurrency ?? 'INR';
    const overallNetMinor = groups.reduce(
      (sum, g) => (g.defaultCurrency === currency ? sum + g.myNetMinor : sum),
      0,
    );
    return { overallNetMinor, currency, groups };
  }

  /**
   * Per-person balances aggregated from the simplified settle-up graph across
   * every group the user shares — the data the Friends screen needs, computed
   * in one call instead of a per-group getGroup + getBalances fan-out.
   */
  async friendBalancesForUser(userId: string): Promise<FriendBalance[]> {
    const myMemberships = await this.prisma.groupMember.findMany({
      where: { userId, removedAt: null },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            defaultCurrency: true,
            members: {
              select: {
                id: true,
                userId: true,
                guestName: true,
                user: { select: { name: true, avatarColor: true } },
              },
            },
          },
        },
      },
    });

    // Read every group's balances in parallel (like forUser) so a cache miss
    // or slow Redis on one group doesn't serialize the whole screen.
    const perGroup = await Promise.all(
      myMemberships.map(async (mine) => ({
        mine,
        settlements: (await this.balances.getForGroup(mine.groupId)).settlements,
      })),
    );

    const byFriend = new Map<string, FriendBalance>();

    for (const { mine, settlements } of perGroup) {
      const group = mine.group;
      const memberById = new Map(group.members.map((m) => [m.id, m]));

      const upsert = (otherMemberId: string): FriendBalance | null => {
        const m = memberById.get(otherMemberId);
        if (!m) return null;
        const key = m.userId ? `user:${m.userId}` : `guest:${otherMemberId}`;
        let f = byFriend.get(key);
        if (!f) {
          f = {
            key,
            name: m.user?.name ?? m.guestName ?? 'Member',
            avatarColor: m.user?.avatarColor ?? null,
            iOweMinor: 0,
            owesMeMinor: 0,
            netMinor: 0,
            currency: group.defaultCurrency,
            groups: [],
          };
          byFriend.set(key, f);
        }
        if (!f.groups.some((g) => g.id === group.id)) {
          f.groups.push({ id: group.id, name: group.name });
        }
        return f;
      };

      for (const t of settlements) {
        if (t.currency !== group.defaultCurrency) continue;
        if (t.fromMemberId === mine.id) {
          const f = upsert(t.toMemberId);
          if (f) f.iOweMinor += t.amountMinor;
        } else if (t.toMemberId === mine.id) {
          const f = upsert(t.fromMemberId);
          if (f) f.owesMeMinor += t.amountMinor;
        }
      }
    }

    const friends = [...byFriend.values()];
    for (const f of friends) f.netMinor = f.owesMeMinor - f.iOweMinor;
    return friends.sort((a, b) => Math.abs(b.netMinor) - Math.abs(a.netMinor));
  }
}
