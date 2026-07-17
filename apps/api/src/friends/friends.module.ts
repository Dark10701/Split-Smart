import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { FriendsService } from './friends.service';
import { FriendsController } from './friends.controller';

@Module({
  imports: [AuthModule, UsersModule],
  providers: [FriendsService],
  controllers: [FriendsController],
})
export class FriendsModule {}
