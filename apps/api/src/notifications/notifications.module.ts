import { Global, Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { NotificationsService } from './notifications.service';

/** Global so any domain module can resolve prefs and dispatch notifications. */
@Global()
@Module({
  imports: [QueueModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
