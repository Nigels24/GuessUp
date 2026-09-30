import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // The mobile app and the admin panel are separate origins.
  app.enableCors({ origin: true, credentials: true });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Question images seeded from the prototype: /static/images/<name>.svg
  app.useStaticAssets(join(process.cwd(), 'public'), { prefix: '/static/' });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0'); // 0.0.0.0 so a phone on the same Wi-Fi can reach it
  console.log(`GuessUp API running on http://localhost:${port}/api`);
}

await bootstrap();
