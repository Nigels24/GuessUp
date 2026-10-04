import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';

/**
 * App-wide settings shared by main.ts and the e2e tests, so the tests run
 * against the same prefix, validation and proxy handling as production.
 */
export function configureApp(app: NestExpressApplication): void {
  // The mobile app and the admin panel are separate origins.
  // Content-Disposition is exposed so the panel can name CSV downloads.
  app.enableCors({ origin: true, credentials: true, exposedHeaders: ['Content-Disposition'] });

  // Render sits behind one proxy hop. Trusting it makes req.ip the student's
  // address instead of the proxy's, which the login rate limit relies on.
  app.set('trust proxy', 1);

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
}
