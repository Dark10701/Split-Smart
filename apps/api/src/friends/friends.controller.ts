import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  friendSearchQuerySchema,
  sendFriendRequestSchema,
  type AuthClaims,
} from '@splitsmart/validation';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsersService } from '../users/users.service';
import {
  FriendsService,
  type FriendsOverview,
  type FriendSearchHit,
  type FriendProfile,
} from './friends.service';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(
    private readonly friends: FriendsService,
    private readonly users: UsersService,
  ) {}

  private async meId(claims: AuthClaims): Promise<string> {
    return (await this.users.resolveFromClaims(claims)).id;
  }

  @Get()
  async overview(@CurrentUser() claims: AuthClaims): Promise<FriendsOverview> {
    return this.friends.overview(await this.meId(claims));
  }

  @Get('search')
  async search(
    @CurrentUser() claims: AuthClaims,
    @Query() query: unknown,
  ): Promise<FriendSearchHit[]> {
    const parsed = friendSearchQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.friends.search(await this.meId(claims), parsed.data.q);
  }

  @Get(':userId/profile')
  async profile(
    @CurrentUser() claims: AuthClaims,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<FriendProfile> {
    return this.friends.profile(await this.meId(claims), userId);
  }

  @Post('requests')
  async sendRequest(
    @CurrentUser() claims: AuthClaims,
    @Body() body: unknown,
  ): Promise<{ id: string; status: string }> {
    const parsed = sendFriendRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const edge = await this.friends.sendRequest(await this.meId(claims), parsed.data.userId);
    return { id: edge.id, status: edge.status };
  }

  @Post('requests/:id/accept')
  async accept(
    @CurrentUser() claims: AuthClaims,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ ok: true }> {
    return this.friends.respond(await this.meId(claims), id, true);
  }

  @Post('requests/:id/reject')
  async reject(
    @CurrentUser() claims: AuthClaims,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ ok: true }> {
    return this.friends.respond(await this.meId(claims), id, false);
  }

  @Delete(':userId')
  async remove(
    @CurrentUser() claims: AuthClaims,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<{ ok: true }> {
    return this.friends.remove(await this.meId(claims), userId);
  }

  @Post(':userId/block')
  async block(
    @CurrentUser() claims: AuthClaims,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<{ ok: true }> {
    return this.friends.block(await this.meId(claims), userId);
  }

  @Delete(':userId/block')
  async unblock(
    @CurrentUser() claims: AuthClaims,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<{ ok: true }> {
    return this.friends.unblock(await this.meId(claims), userId);
  }
}
