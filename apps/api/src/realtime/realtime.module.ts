import { Global, Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

/** Global so any module can inject the gateway to publish updates. */
@Global()
@Module({
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
