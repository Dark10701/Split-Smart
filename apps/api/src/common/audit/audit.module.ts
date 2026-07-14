import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/** Global so any domain module can record audit entries (M6-02). */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
