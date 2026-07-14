import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { updateMeSchema, type AuthClaims } from '@splitsmart/validation';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { AuditService } from '../common/audit/audit.service';
import { UsersService, type UserDataExport } from './users.service';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async me(@CurrentUser() claims: AuthClaims): Promise<User> {
    return this.users.resolveFromClaims(claims);
  }

  @Patch()
  async update(@CurrentUser() claims: AuthClaims, @Body() body: unknown): Promise<User> {
    const parsed = updateMeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const user = await this.users.resolveFromClaims(claims);
    return this.users.update(user.id, parsed.data);
  }

  /** GDPR/DPDP data export (M6-17). Rate-limited — it's an expensive fan-out. */
  @Get('export')
  @RateLimit(5, 3600)
  async export(@CurrentUser() claims: AuthClaims): Promise<UserDataExport> {
    const user = await this.users.resolveFromClaims(claims);
    const bundle = await this.users.exportData(user.id);
    this.audit.record({
      actorUserId: user.id,
      action: 'account.exported',
      targetType: 'user',
      targetId: user.id,
    });
    return bundle;
  }

  /** GDPR/DPDP right-to-erasure (M6-18). Anonymizes; retains financial history. */
  @Delete()
  @RateLimit(3, 3600)
  async deleteMe(@CurrentUser() claims: AuthClaims): Promise<{ deleted: true }> {
    const user = await this.users.resolveFromClaims(claims);
    const result = await this.users.deleteAccount(user.id);
    this.audit.record({
      actorUserId: user.id,
      action: 'account.deleted',
      targetType: 'user',
      targetId: user.id,
      metadata: { anonymizedMemberships: result.anonymizedMemberships },
    });
    return { deleted: true };
  }
}
