import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

/**
 * End-to-end check for the health endpoint.
 * Needs a reachable DATABASE_URL, so run it with the database up:
 *   npm run test:e2e
 */
describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        if (res.body.status !== 'ok') throw new Error('status is not ok');
        if (res.body.db !== 'up') throw new Error('database is not reachable');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
