// Tracing must load before any instrumented library (http/express/pg) — keep
// this the FIRST import so OpenTelemetry can patch them (M6-05).
import './observability/tracing';
import 'reflect-metadata';
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import { initSentry } from './observability/sentry';
import { SentryExceptionFilter } from './observability/sentry.filter';

async function bootstrap(): Promise<void> {
  const sentryEnabled = initSentry();
  const app = await NestFactory.create(AppModule);

  // Report unexpected 5xx errors to Sentry when configured (M6-09).
  if (sentryEnabled) {
    const { httpAdapter } = app.get(HttpAdapterHost);
    app.useGlobalFilters(new SentryExceptionFilter(httpAdapter));
    Logger.log('Sentry error tracking enabled', 'Bootstrap');
  }

  // Baseline security headers (M6). The API serves JSON only and never renders
  // HTML, so a locked-down CSP plus the standard hardening headers are enough
  // without pulling in a helmet dependency.
  app.use((_req: Request, res: Response, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.removeHeader('X-Powered-By');
    next();
  });

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
