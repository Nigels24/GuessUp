import { ServiceUnavailableException } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { App } from 'supertest/types';
import { CLOUDINARY_FOLDERS, type CloudinaryFolder } from './../src/common/cloudinary-folders.js';
import { CLOUDINARY_MESSAGES, CloudinaryService, type UploadOptions } from './../src/cloudinary/cloudinary.service.js';
import { AVATAR_MESSAGES } from './../src/me/avatar.rules.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { allKeys, createApp, createTestAccount, deleteTestAccounts, type TestAccount } from './helpers.js';

/**
 * End-to-end: student profile photos (POST/DELETE /api/me/avatar) and where
 * avatarUrl shows up. Cloudinary is replaced by a fake, so no file is ever
 * uploaded; the accounts are e2e-… throwaways, deleted after.
 *   npm run test:e2e
 */

/** Records what would have been uploaded and deleted. */
class FakeCloudinary {
  configured = true;
  uploads: { folder: CloudinaryFolder; options: UploadOptions }[] = [];
  destroyed: { publicId: string; folder: CloudinaryFolder }[] = [];

  assertConfigured(): void {
    if (!this.configured) throw new ServiceUnavailableException(CLOUDINARY_MESSAGES.notConfigured);
  }

  async upload(_buffer: Buffer, folder: CloudinaryFolder, options: UploadOptions = {}) {
    this.assertConfigured();
    this.uploads.push({ folder, options });
    const publicId = `${CLOUDINARY_FOLDERS[folder]}/${options.publicId ?? 'random'}`;
    return { url: `https://res.cloudinary.com/demo/image/upload/f_auto/v1/${publicId}`, publicId };
  }

  async destroy(publicId: string | null | undefined, folder: CloudinaryFolder): Promise<void> {
    if (publicId) this.destroyed.push({ publicId, folder });
  }
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);

describe('Profile photo (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;
  let prisma: PrismaService;
  const fake = new FakeCloudinary();
  const accounts: TestAccount[] = [];
  let student: TestAccount;
  let studentToken: string;
  let adminToken: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (account: TestAccount) =>
    (await request(http).post('/api/auth/login').send({ email: account.email, password: account.password }).expect(200))
      .body.accessToken as string;
  const upload = (token: string, buffer: Buffer, name = 'me.jpg') =>
    request(http).post('/api/me/avatar').set(auth(token)).attach('file', buffer, name);

  beforeAll(async () => {
    app = await createApp([], (builder) => builder.overrideProvider(CloudinaryService).useValue(fake));
    http = app.getHttpServer() as App;
    prisma = app.get(PrismaService);
    student = await createTestAccount(prisma, 'STUDENT', 'avatar');
    accounts.push(student);
    const admin = await createTestAccount(prisma, 'ADMIN', 'avatar-admin');
    accounts.push(admin);
    studentToken = await login(student);
    adminToken = await login(admin);
  }, 60_000);

  afterAll(async () => {
    if (prisma) await deleteTestAccounts(prisma, accounts.map((a) => a.email));
    await app?.close();
  }, 60_000);

  beforeEach(() => {
    fake.configured = true;
    fake.uploads = [];
    fake.destroyed = [];
  });

  it('a new student has no photo (avatarUrl null)', async () => {
    const res = await request(http).get('/api/auth/me').set(auth(studentToken)).expect(200);
    expect(res.body.avatarUrl).toBeNull();
    expect(allKeys(res.body)).not.toContain('avatarPublicId');
  });

  it('refuses a missing file, a non-image, SVG and anything over 2 MB (400)', async () => {
    const none = await request(http).post('/api/me/avatar').set(auth(studentToken)).expect(400);
    expect(none.body.message).toBe(AVATAR_MESSAGES.missing);

    const text = await upload(studentToken, Buffer.from('not an image'), 'photo.jpg').expect(400);
    expect(text.body.message).toBe(AVATAR_MESSAGES.badType);

    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect((await upload(studentToken, svg, 'photo.svg').expect(400)).body.message).toBe(AVATAR_MESSAGES.badType);

    const big = Buffer.concat([JPG, Buffer.alloc(2 * 1024 * 1024)]);
    expect((await upload(studentToken, big).expect(400)).body.message).toBe(AVATAR_MESSAGES.tooLarge);

    expect(fake.uploads).toEqual([]);
  });

  it('answers 503 with a clear message when Cloudinary is not configured', async () => {
    fake.configured = false;
    const res = await upload(studentToken, JPG).expect(503);
    expect(res.body.message).toMatch(/CLOUDINARY_CLOUD_NAME/);
  });

  it('is for students only: administrators get 403, no token 401', async () => {
    await upload(adminToken, JPG).expect(403);
    await request(http).delete('/api/me/avatar').set(auth(adminToken)).expect(403);
    await request(http).post('/api/me/avatar').attach('file', JPG, 'me.jpg').expect(401);
    await request(http).delete('/api/me/avatar').expect(401);
  });

  it('uploads into guessup/avatars and returns avatarUrl, never the public id', async () => {
    const res = await upload(studentToken, JPG).expect(200);
    expect(fake.uploads).toHaveLength(1);
    expect(fake.uploads[0]!.folder).toBe('avatars');
    expect(fake.uploads[0]!.options.publicId).toMatch(new RegExp(`^user-${student.id}-\\d+$`));
    expect(res.body.avatarUrl).toMatch(/^https:\/\/res\.cloudinary\.com\/.+\/guessup\/avatars\/user-/);
    expect(allKeys(res.body)).not.toContain('avatarPublicId');
    expect(fake.destroyed).toEqual([]);

    const me = await request(http).get('/api/me').set(auth(studentToken)).expect(200);
    expect(me.body.avatarUrl).toBe(res.body.avatarUrl);
    const authMe = await request(http).get('/api/auth/me').set(auth(studentToken)).expect(200);
    expect(authMe.body.avatarUrl).toBe(res.body.avatarUrl);
    const patched = await request(http).patch('/api/me').set(auth(studentToken)).send({ fullName: 'e2e-avatar' }).expect(200);
    expect(patched.body.avatarUrl).toBe(res.body.avatarUrl);
  });

  it('a new photo replaces the old one, whose file is then deleted', async () => {
    const { avatarPublicId: old } = await prisma.user.findUniqueOrThrow({ where: { id: student.id } });
    expect(old).toMatch(/^guessup\/avatars\//);
    // A distinct timestamp in the new file name.
    await new Promise((resolve) => setTimeout(resolve, 5));
    const res = await upload(studentToken, PNG, 'me.png').expect(200);
    const { avatarPublicId: now } = await prisma.user.findUniqueOrThrow({ where: { id: student.id } });
    expect(now).not.toBe(old);
    expect(res.body.avatarUrl).toContain(now);
    expect(fake.destroyed).toEqual([{ publicId: old, folder: 'avatars' }]);
  });

  it('shows the photo on the leaderboard and to administrators, never the public id', async () => {
    const { avatarUrl } = await prisma.user.findUniqueOrThrow({ where: { id: student.id } });
    const category = await prisma.category.findFirstOrThrow({ orderBy: { createdAt: 'asc' } });
    // A ranked row without playing a round (deleted with the account).
    await prisma.leaderboardEntry.create({ data: { userId: student.id, categoryId: category.id } });

    const board = await request(http).get(`/api/leaderboard/${category.id}`).set(auth(studentToken)).expect(200);
    expect(board.body.me.avatarUrl).toBe(avatarUrl);
    for (const row of board.body.rows) expect(row).toHaveProperty('avatarUrl');
    expect(allKeys(board.body)).not.toContain('avatarPublicId');

    const list = await request(http)
      .get('/api/admin/students')
      .query({ search: student.email })
      .set(auth(adminToken))
      .expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].avatarUrl).toBe(avatarUrl);
    const detail = await request(http).get(`/api/admin/students/${student.id}`).set(auth(adminToken)).expect(200);
    expect(detail.body.avatarUrl).toBe(avatarUrl);
    expect(allKeys([list.body, detail.body])).not.toContain('avatarPublicId');
  });

  it('DELETE removes the photo and its file, and is idempotent (204 twice)', async () => {
    const { avatarPublicId } = await prisma.user.findUniqueOrThrow({ where: { id: student.id } });
    await request(http).delete('/api/me/avatar').set(auth(studentToken)).expect(204);
    expect(fake.destroyed).toEqual([{ publicId: avatarPublicId, folder: 'avatars' }]);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: student.id } });
    expect(after.avatarUrl).toBeNull();
    expect(after.avatarPublicId).toBeNull();

    await request(http).delete('/api/me/avatar').set(auth(studentToken)).expect(204);
    expect(fake.destroyed).toHaveLength(1);
    const me = await request(http).get('/api/auth/me').set(auth(studentToken)).expect(200);
    expect(me.body.avatarUrl).toBeNull();
  });
});
