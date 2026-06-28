import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { QueueModule } from '../queue/queue.module';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { GroupMembershipGuard } from './group-membership.guard';

@Module({
  imports: [AuthModule, UsersModule, QueueModule],
  providers: [GroupsService, GroupMembershipGuard],
  controllers: [GroupsController],
  exports: [GroupsService],
})
export class GroupsModule {}
