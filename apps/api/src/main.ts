import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  Logger.log(`SplitSmart API listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
