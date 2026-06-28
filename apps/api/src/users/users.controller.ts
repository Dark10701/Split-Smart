import { Body, Controller, Get, Patch, UseGuards, BadRequestException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { updateMeSchema, type AuthClaims } from '@splitsmart/validation';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsersService } from './users.service';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

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
}
