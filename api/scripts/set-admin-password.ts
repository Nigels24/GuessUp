/**
 * Sets a new password for one administrator account, in the database of
 * DATABASE_URL (api/.env). Values come from the environment so they never
 * appear in the code or in the command's arguments:
 *
 *   ADMIN_EMAIL           the administrator's email
 *   NEW_ADMIN_PASSWORD    the new password (10 to 72 characters)
 *
 *   npm run admin:set-password
 *
 * Only that user is updated, and only if its role is ADMIN. The password is
 * hashed exactly like registration does (bcrypt, BCRYPT_ROUNDS) and is never
 * printed.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '../src/auth/auth.constants.js';

const MIN_LENGTH = 10;
/** bcrypt only uses the first 72 bytes; longer input is refused, as in registration. */
const MAX_BYTES = 72;

async function main(): Promise<number> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.NEW_ADMIN_PASSWORD ?? '';

  if (!email) return fail('ADMIN_EMAIL is not set.');
  if (!password) return fail('NEW_ADMIN_PASSWORD is not set.');
  if (password.length < MIN_LENGTH) return fail(`The new password must be at least ${MIN_LENGTH} characters.`);
  if (Buffer.byteLength(password, 'utf8') > MAX_BYTES) return fail(`The new password must be at most ${MAX_BYTES} bytes.`);

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
    if (!user) return fail(`No account with the email ${email}.`);
    if (user.role !== 'ADMIN') return fail(`${email} is not an administrator account. Nothing was changed.`);

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    // Conditional on the role as well, so only this administrator can ever be changed.
    const updated = await prisma.user.updateMany({
      where: { id: user.id, role: 'ADMIN' },
      data: { passwordHash },
    });
    if (updated.count !== 1) return fail('The account changed meanwhile. Nothing was changed.');
    console.log(`Success: the password of ${email} was changed.`);
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

function fail(message: string): number {
  console.error(`Failed: ${message}`);
  return 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(`Failed: ${error instanceof Error ? error.message : 'unexpected error'}`);
    process.exitCode = 1;
  });
