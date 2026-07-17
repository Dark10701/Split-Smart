import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { NotificationPref, User } from '@prisma/client';
import type {
  AuthClaims,
  UpdateMeInput,
  UpdateNotificationPrefsInput,
} from '@splitsmart/validation';
import { PrismaService } from '../database/prisma.service';
import { claimsToUserUpsert } from '../auth/claims';
import { defaultNotificationPrefs } from './notification-defaults';

/** A user's full data bundle for GDPR/DPDP export (M6-17). */
export interface UserDataExport {
  exportedAt: string;
  profile: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
    defaultCurrency: string;
    upiId: string | null;
    createdAt: Date;
  };
  notificationPrefs: unknown[];
  memberships: unknown[];
  expensesCreated: unknown[];
  splits: unknown[];
  payments: unknown[];
  comments: unknown[];
  activity: unknown[];
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve the internal user for verified claims, creating them on first sign-in. */
  async resolveFromClaims(claims: AuthClaims): Promise<User> {
    const data = claimsToUserUpsert(claims);
    const existing = await this.prisma.user.findUnique({
      where: { authSubject: data.authSubject },
    });
    if (existing) return existing;

    // Same email under a new subject (e.g. a different connection at the same
    // issuer): link the verified email to the existing account instead of
    // failing the unique constraint. The claims were signature-verified against
    // our configured issuer, so the email is trusted.
    const byEmail = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (byEmail) {
      return this.prisma.user.update({
        where: { id: byEmail.id },
        data: {
          authSubject: data.authSubject,
          // Backfill the mobile number from the IdP for pre-phone accounts.
          ...(byEmail.phone === null && data.phone ? { phone: data.phone } : {}),
        },
      });
    }

    const prefs = { create: defaultNotificationPrefs('').map(({ userId: _u, ...p }) => p) };
    try {
      return await this.prisma.user.create({
        data: {
          authSubject: data.authSubject,
          email: data.email,
          name: data.name,
          phone: data.phone,
          notificationPrefs: prefs,
        },
      });
    } catch (e) {
      // Phone already taken by another account: still create the identity —
      // sign-in must not fail — and let the user set a phone from their profile.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && data.phone) {
        return this.prisma.user.create({
          data: {
            authSubject: data.authSubject,
            email: data.email,
            name: data.name,
            notificationPrefs: prefs,
          },
        });
      }
      throw e;
    }
  }

  async update(userId: string, input: UpdateMeInput): Promise<User> {
    try {
      return await this.prisma.user.update({ where: { id: userId }, data: input });
    } catch (e) {
      // Unique-constraint hit (phone/email already belongs to another account).
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('That mobile number is already linked to another account');
      }
      throw e;
    }
  }

  /** List a user's per-channel/type notification preferences (M6-14). */
  async listNotificationPrefs(userId: string): Promise<NotificationPref[]> {
    return this.prisma.notificationPref.findMany({
      where: { userId },
      orderBy: [{ type: 'asc' }, { channel: 'asc' }],
    });
  }

  /**
   * Apply a sparse set of notification-pref toggles (M6-14). Each (channel,
   * type) pair is upserted against the unique index, so a pref missing at
   * signup (e.g. added in a later release) is created rather than silently
   * dropped. Returns the full, updated preference list.
   */
  async updateNotificationPrefs(
    userId: string,
    input: UpdateNotificationPrefsInput,
  ): Promise<NotificationPref[]> {
    await this.prisma.$transaction(
      input.prefs.map((p) =>
        this.prisma.notificationPref.upsert({
          where: { userId_channel_type: { userId, channel: p.channel, type: p.type } },
          create: { userId, channel: p.channel, type: p.type, enabled: p.enabled },
          update: { enabled: p.enabled },
        }),
      ),
    );
    return this.listNotificationPrefs(userId);
  }

  /**
   * Assemble everything SplitSmart holds about a user (M6-17). Read-only;
   * includes their profile, memberships, authored expenses, the splits/payments
   * they're party to, comments, and activity they performed.
   */
  async exportData(userId: string): Promise<UserDataExport> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { notificationPrefs: true },
    });
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId },
      include: { group: { select: { id: true, name: true, defaultCurrency: true } } },
    });
    const memberIds = memberships.map((m) => m.id);

    const [expensesCreated, splits, payments, comments, activity] = await Promise.all([
      this.prisma.expense.findMany({
        where: { createdById: userId },
        include: { splits: true, items: true },
      }),
      this.prisma.expenseSplit.findMany({ where: { memberId: { in: memberIds } } }),
      this.prisma.payment.findMany({
        where: {
          OR: [{ fromMemberId: { in: memberIds } }, { toMemberId: { in: memberIds } }],
        },
      }),
      this.prisma.comment.findMany({ where: { authorId: userId } }),
      this.prisma.activityLog.findMany({ where: { actorId: userId } }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        defaultCurrency: user.defaultCurrency,
        upiId: user.upiId,
        createdAt: user.createdAt,
      },
      notificationPrefs: user.notificationPrefs,
      memberships,
      expensesCreated,
      splits,
      payments,
      comments,
      activity,
    };
  }

  /**
   * GDPR/DPDP right-to-erasure (M6-18). Money is sacred and other members' group
   * history must stay intact, so this **anonymizes** rather than hard-deletes:
   * PII on the user row is scrubbed, the login binding is broken (a new sign-in
   * creates a fresh account), notification prefs are dropped, and memberships
   * are soft-removed. Expenses, splits, and payments are retained — they
   * reference the (now anonymized) member, preserving every other member's
   * balances. Returns the number of memberships anonymized.
   */
  async deleteAccount(userId: string): Promise<{ anonymizedMemberships: number }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.notificationPref.deleteMany({ where: { userId } });
      const memberships = await tx.groupMember.updateMany({
        where: { userId, removedAt: null },
        data: { removedAt: new Date() },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          name: 'Deleted user',
          // Unique, non-routable tombstones keep the unique constraints happy
          // while guaranteeing the old identity can never be reused or contacted.
          email: `deleted+${userId}@deleted.invalid`,
          authSubject: `deleted:${userId}`,
          phone: null,
          upiId: null,
        },
      });
      return { anonymizedMemberships: memberships.count };
    });
  }
}
