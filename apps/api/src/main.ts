import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import type { Request } from 'express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // Capture the raw request body so provider webhook signatures (M4) can be
  // verified against the exact bytes the provider signed.
  app.use(
    express.json({
      verify: (req: Request & { rawBody?: string }, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    }),
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  Logger.log(`SplitSmart API listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
