import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { AuthClaims, UpdateMeInput } from '@splitsmart/validation';
import { PrismaService } from '../database/prisma.service';
import { claimsToUserUpsert } from '../auth/claims';
import { defaultNotificationPrefs } from './notification-defaults';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve the internal user for verified claims, creating them on first sign-in. */
  async resolveFromClaims(claims: AuthClaims): Promise<User> {
    const data = claimsToUserUpsert(claims);
    const existing = await this.prisma.user.findUnique({ where: { authSubject: data.authSubject } });
    if (existing) return existing;

    return this.prisma.user.create({
      data: {
        authSubject: data.authSubject,
        email: data.email,
        name: data.name,
        notificationPrefs: { create: defaultNotificationPrefs('').map(({ userId: _u, ...p }) => p) },
      },
    });
  }

  async update(userId: string, input: UpdateMeInput): Promise<User> {
    return this.prisma.user.update({ where: { id: userId }, data: input });
  }
}
