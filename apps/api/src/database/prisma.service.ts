import { Injectable, Logger, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch (err) {
      this.logger.warn(
        `Database not reachable at startup: ${(err as Error).message}. ` +
          'The API will still run, but database operations will fail until Postgres is up. ' +
          'Run "docker compose up -d" and "pnpm --filter @splitsmart/api prisma:generate".',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
