import { Module } from '@nestjs/common';
import { NotificationsProducer } from './notifications.producer';
import { INVITE_NOTIFIER } from './invite-notifier';
import { NOTIFICATION_DISPATCHER } from './notification-dispatch';

@Module({
  providers: [
    NotificationsProducer,
    { provide: INVITE_NOTIFIER, useExisting: NotificationsProducer },
    { provide: NOTIFICATION_DISPATCHER, useExisting: NotificationsProducer },
  ],
  exports: [INVITE_NOTIFIER, NOTIFICATION_DISPATCHER],
})
export class QueueModule {}
