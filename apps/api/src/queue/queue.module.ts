import { Module } from '@nestjs/common';
import { NotificationsProducer } from './notifications.producer';
import { INVITE_NOTIFIER } from './invite-notifier';

@Module({
  providers: [
    NotificationsProducer,
    { provide: INVITE_NOTIFIER, useExisting: NotificationsProducer },
  ],
  exports: [INVITE_NOTIFIER],
})
export class QueueModule {}
