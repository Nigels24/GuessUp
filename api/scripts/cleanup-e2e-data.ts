/**
 * One-off cleanup of rows left behind by the e2e tests (test/*.e2e-spec.ts)
 * in the database of DATABASE_URL (api/.env).
 *
 *   npx tsx scripts/cleanup-e2e-data.ts            # dry run (default): lists what it would delete
 *   npx tsx scripts/cleanup-e2e-data.ts --delete   # deletes it, in one transaction
 *
 * Only rows that are clearly test data are touched:
 *   - users:      accounts whose email is <...>e2e-<...>@example.com (every e2e
 *                 spec registers its students and creates its administrators
 *                 that way; real accounts never use example.com)
 *   - categories: slug starting with "e2e-" (never a seeded slug)
 *   - questions:  not seeded (seedKey is null) and either in an e2e category or
 *                 with a question text starting with "e2e-" / "E2E "
 *   - game sessions of those users or in those categories; their answers,
 *     and the users' / categories' leaderboard rows and badges go with them
 *     (the same cascades the tests rely on)
 * Anything else that is not seed data is only listed, for a person to review.
 * Cloudinary images are not deleted here; their public ids are printed.
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { categories as seedCategories } from '../prisma/seed-data/categories.js';

const SEEDED_EMAILS = ['admin@jhcsc.edu.ph', 'student@jhcsc.edu.ph'];
const SEEDED_SLUGS = seedCategories.map((c) => c.slug);

const TEST_USER: Prisma.UserWhereInput = {
  email: { contains: 'e2e-', endsWith: '@example.com' },
};
const TEST_CATEGORY: Prisma.CategoryWhereInput = {
  slug: { startsWith: 'e2e-', notIn: SEEDED_SLUGS },
};

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const remove = process.argv.includes('--delete');
  console.log(remove ? 'DELETE mode: removing e2e test data…' : 'Dry run (nothing is deleted). Pass --delete to remove.');

  const users = await prisma.user.findMany({ where: TEST_USER, select: { id: true, email: true, role: true } });
  const categories = await prisma.category.findMany({ where: TEST_CATEGORY, select: { id: true, slug: true, name: true } });
  const userIds = users.map((u) => u.id);
  const categoryIds = categories.map((c) => c.id);

  const questionWhere: Prisma.QuestionWhereInput = {
    seedKey: null,
    OR: [
      { categoryId: { in: categoryIds } },
      { questionText: { startsWith: 'e2e-' } },
      { questionText: { startsWith: 'E2E ' } },
    ],
  };
  const sessionWhere: Prisma.GameSessionWhereInput = {
    OR: [{ userId: { in: userIds } }, { categoryId: { in: categoryIds } }],
  };

  const questions = await prisma.question.findMany({
    where: questionWhere,
    select: { id: true, questionText: true, imagePublicId: true },
  });
  const questionIds = questions.map((q) => q.id);
  const sessions = await prisma.gameSession.count({ where: sessionWhere });
  const answers = await prisma.answer.count({ where: { session: sessionWhere } });
  // Answers outside the test sessions that point at test questions would block deleting them.
  const foreignAnswers = await prisma.answer.count({
    where: { questionId: { in: questionIds }, NOT: { session: sessionWhere } },
  });
  const leaderboard = await prisma.leaderboardEntry.count({
    where: { OR: [{ userId: { in: userIds } }, { categoryId: { in: categoryIds } }] },
  });
  const badges = await prisma.studentBadge.count({ where: { userId: { in: userIds } } });

  console.log('\nTest data found:');
  console.log(`  users:               ${users.length}`);
  for (const u of users) console.log(`    - ${u.email} (${u.role})`);
  console.log(`  categories:          ${categories.length}`);
  for (const c of categories) console.log(`    - ${c.slug} (${c.name})`);
  console.log(`  questions:           ${questions.length}`);
  for (const q of questions) console.log(`    - ${q.id} "${q.questionText.slice(0, 60)}"`);
  console.log(`  game sessions:       ${sessions}`);
  console.log(`  answers:             ${answers} (deleted with their sessions)`);
  console.log(`  leaderboard entries: ${leaderboard} (deleted with their user/category)`);
  console.log(`  badges:              ${badges} (deleted with their user)`);
  const images = questions.flatMap((q) => (q.imagePublicId ? [q.imagePublicId] : []));
  if (images.length) {
    console.log('  Cloudinary images of these questions (delete them in the Cloudinary console):');
    for (const id of images) console.log(`    - ${id}`);
  }

  await reportUnrecognized(userIds, categoryIds, questionIds);

  if (foreignAnswers) {
    throw new Error(
      `${foreignAnswers} answers from non-test rounds point at test questions; nothing was deleted. Review these by hand.`,
    );
  }
  const total = users.length + categories.length + questions.length + sessions;
  if (!remove || !total) {
    if (!total) console.log('\nNothing to clean up.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Order matters: sessions (answers cascade) before users, questions and categories,
    // which they reference without a cascade.
    const s = await tx.gameSession.deleteMany({ where: sessionWhere });
    const q = await tx.question.deleteMany({ where: { id: { in: questionIds } } });
    const c = await tx.category.deleteMany({ where: { id: { in: categoryIds } } });
    const u = await tx.user.deleteMany({ where: { id: { in: userIds } } });
    console.log(`\nDeleted: ${s.count} sessions, ${q.count} questions, ${c.count} categories, ${u.count} users.`);
  });
}

/** Non-seed rows the rules above do not recognize as test data: listed only, never deleted. */
async function reportUnrecognized(userIds: string[], categoryIds: string[], questionIds: string[]) {
  const [users, categories, questions] = await Promise.all([
    prisma.user.findMany({
      where: { email: { notIn: SEEDED_EMAILS }, id: { notIn: userIds } },
      select: { email: true, role: true, createdAt: true },
    }),
    prisma.category.findMany({
      where: { slug: { notIn: SEEDED_SLUGS }, id: { notIn: categoryIds } },
      select: { slug: true, name: true },
    }),
    prisma.question.count({ where: { seedKey: null, id: { notIn: questionIds } } }),
  ]);
  console.log('\nOther non-seed rows (NOT test data by these rules; left alone):');
  console.log(`  users:      ${users.length}`);
  for (const u of users) console.log(`    - ${maskEmail(u.email)} (${u.role}, created ${u.createdAt.toISOString().slice(0, 10)})`);
  console.log(`  categories: ${categories.length}`);
  for (const c of categories) console.log(`    - ${c.slug} (${c.name})`);
  console.log(`  questions not in the seed: ${questions}`);
}

/** Real people's addresses are shown partly, e.g. ju***@gmail.com. */
function maskEmail(email: string): string {
  const [name = '', domain = ''] = email.split('@');
  return `${name.slice(0, 2)}***@${domain}`;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
