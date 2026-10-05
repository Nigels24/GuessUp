/**
 * Demo data for the defense: about 25 students with three weeks of rounds,
 * answers, leaderboard rows and badges, in the database of DATABASE_URL
 * (api/.env). Dry run unless --apply is given.
 *
 *   npm run demo:seed                     # dry run: prints what it would create
 *   npm run demo:seed -- --apply          # creates it (refused if demo data exists)
 *   npm run demo:remove                   # dry run: prints what it would delete
 *   npm run demo:remove -- --apply        # deletes every demo row
 *   ... -- --seed=7                       # another random plan (default 2026)
 *
 * Demo data is found ONLY by the email domain @demo.jhcsc.edu.ph: demo
 * accounts, and their rounds, answers, leaderboard rows and badges. No other
 * account, question, category, round or badge is ever written or deleted.
 * Questions and categories are only read: rounds use the active seeded items.
 * Each mode is one transaction, so a failure leaves the database unchanged.
 *
 * The rounds follow the real game rules (scripts/demo-data/plan.ts reuses
 * drawRound, judgeAnswer/scoreAnswer, accuracyPercent and evaluateBadges).
 * Demo students get random passwords that are never printed (nobody signs in
 * as them) and no profile photo.
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { categories as seedCategories } from '../prisma/seed-data/categories.js';
import { BCRYPT_ROUNDS } from '../src/auth/auth.constants.js';
import { BADGES } from '../src/common/badges.js';
import {
  DEMO_DAYS,
  DEMO_EMAIL_DOMAIN,
  buildDemoPlan,
  isDemoEmail,
  type CatalogCategory,
  type DemoPlan,
} from './demo-data/plan.js';

const DEMO_USERS: Prisma.UserWhereInput = {
  email: { endsWith: `@${DEMO_EMAIL_DOMAIN}`, mode: 'insensitive' },
};
const DEFAULT_SEED = 2026;
/** Neon from the Philippines: a few hundred rows per statement, well within this. */
const TRANSACTION = { maxWait: 20_000, timeout: 120_000 } as const;

const prisma = new PrismaClient();

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const remove = args.includes('--remove');
  const seedArg = args.find((a) => a.startsWith('--seed='));
  const seed = seedArg ? Number(seedArg.slice('--seed='.length)) : DEFAULT_SEED;
  const unknown = args.filter((a) => a !== '--apply' && a !== '--remove' && !a.startsWith('--seed='));
  if (unknown.length || !Number.isInteger(seed)) {
    console.error(`Unknown option(s): ${unknown.join(' ') || seedArg}. Use --apply, --remove, --seed=<integer>.`);
    return 1;
  }

  console.log(`Database: ${describeDatabase(process.env.DATABASE_URL)}`);
  console.log(
    apply
      ? remove
        ? 'REMOVE mode: deleting demo data…'
        : 'APPLY mode: creating demo data…'
      : `Dry run (nothing is written). Add -- --apply to ${remove ? 'delete' : 'create'} it.`,
  );
  return remove ? removeDemo(apply) : seedDemo(apply, seed);
}

/* ---------- create ---------- */

async function seedDemo(apply: boolean, seed: number): Promise<number> {
  const existing = await prisma.user.count({ where: DEMO_USERS });
  if (existing) {
    console.log(`\nDemo data already exists (${existing} @${DEMO_EMAIL_DOMAIN} accounts).`);
    console.log('Run `npm run demo:remove -- --apply` first, then seed again.');
    if (apply) return 1;
  }

  const categories: CatalogCategory[] = await prisma.category.findMany({
    where: { slug: { in: seedCategories.map((c) => c.slug) } },
    select: { id: true, slug: true, name: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  // The pool GameService.start draws from (active items), limited to the seeded ones.
  const questions = await prisma.question.findMany({
    where: { categoryId: { in: categories.map((c) => c.id) }, isActive: true, seedKey: { not: null } },
    select: {
      id: true,
      categoryId: true,
      difficulty: true,
      type: true,
      answer: true,
      alternates: true,
      choices: true,
      seedKey: true,
    },
  });
  if (categories.length !== seedCategories.length) {
    console.error(`\nExpected the ${seedCategories.length} seeded categories, found ${categories.length}. Run the seed first.`);
    return 1;
  }
  for (const c of categories) {
    for (const d of ['EASY', 'AVERAGE', 'DIFFICULT'] as const) {
      const n = questions.filter((q) => q.categoryId === c.id && q.difficulty === d).length;
      if (n < 5) console.log(`  note: ${c.name} ${d} has ${n} active seeded items; rounds there borrow other levels, as the API does.`);
    }
  }

  const plan = buildDemoPlan({ categories, questions, now: new Date(), seed, newId });
  if (plan.students.some((s) => !isDemoEmail(s.email))) throw new Error('A planned account is outside the demo domain.');
  printSummary(plan, categories, new Map(questions.map((q) => [q.id, q.seedKey ?? q.id])), seed);

  if (!apply) return 0;
  if (existing) return 1;

  // Hashing first keeps the transaction short. The passwords are never shown.
  const hashes = await Promise.all(
    plan.students.map(() => bcrypt.hash(randomBytes(24).toString('base64url'), BCRYPT_ROUNDS)),
  );

  await prisma.$transaction(async (tx) => {
    if (await tx.user.count({ where: DEMO_USERS })) throw new Error('Demo data appeared meanwhile; nothing was created.');
    await tx.user.createMany({
      data: plan.students.map((s, i) => ({
        id: s.id,
        fullName: s.fullName,
        email: s.email,
        passwordHash: hashes[i]!,
        role: 'STUDENT' as const,
        yearLevel: s.yearLevel,
        status: 'ACTIVE' as const,
        createdAt: s.createdAt,
      })),
    });
    await tx.gameSession.createMany({
      data: plan.sessions.map((s) => ({
        ...s,
        currentServedAt: null,
        currentHintUsed: false,
      })),
    });
    await tx.answer.createMany({ data: plan.answers.map(({ kind: _kind, ...a }) => a) });
    await tx.leaderboardEntry.createMany({ data: plan.leaderboard });
    await tx.studentBadge.createMany({ data: plan.badges });

    // Read back what is now in the database for the demo accounts.
    const ids = plan.students.map((s) => s.id);
    const [users, sessions, answers, entries, badges] = await Promise.all([
      tx.user.count({ where: { id: { in: ids }, ...DEMO_USERS } }),
      tx.gameSession.count({ where: { userId: { in: ids } } }),
      tx.answer.count({ where: { session: { userId: { in: ids } } } }),
      tx.leaderboardEntry.count({ where: { userId: { in: ids } } }),
      tx.studentBadge.count({ where: { userId: { in: ids } } }),
    ]);
    const expected = [plan.students.length, plan.sessions.length, plan.answers.length, plan.leaderboard.length, plan.badges.length];
    if ([users, sessions, answers, entries, badges].some((n, i) => n !== expected[i])) {
      throw new Error(`Row counts do not match the plan (${[users, sessions, answers, entries, badges]} vs ${expected}); rolled back.`);
    }
  }, TRANSACTION);

  console.log('\nCreated. Remove it any time with `npm run demo:remove -- --apply`.');
  return 0;
}

/* ---------- remove ---------- */

async function removeDemo(apply: boolean): Promise<number> {
  const users = await prisma.user.findMany({
    where: DEMO_USERS,
    select: { id: true, email: true, role: true },
    orderBy: { email: 'asc' },
  });
  const outside = users.filter((u) => u.role !== 'STUDENT' || !isDemoEmail(u.email));
  if (outside.length) {
    console.error(`\nRefusing: ${outside.map((u) => `${u.email} (${u.role})`).join(', ')} is not a demo student. Nothing was deleted.`);
    return 1;
  }
  const ids = users.map((u) => u.id);
  const sessions: Prisma.GameSessionWhereInput = { userId: { in: ids } };
  const [rounds, answers, entries, badges] = await Promise.all([
    prisma.gameSession.count({ where: sessions }),
    prisma.answer.count({ where: { session: sessions } }),
    prisma.leaderboardEntry.count({ where: { userId: { in: ids } } }),
    prisma.studentBadge.count({ where: { userId: { in: ids } } }),
  ]);

  console.log(`\nDemo data found (@${DEMO_EMAIL_DOMAIN} only):`);
  console.log(`  students:          ${users.length}`);
  for (const u of users) console.log(`    - ${u.email}`);
  console.log(`  rounds:            ${rounds}`);
  console.log(`  answers:           ${answers}`);
  console.log(`  leaderboard rows:  ${entries}`);
  console.log(`  badges:            ${badges}`);
  if (!users.length) {
    console.log('\nNothing to remove.');
    return 0;
  }
  if (!apply) return 0;

  await prisma.$transaction(async (tx) => {
    await tx.answer.deleteMany({ where: { session: sessions } });
    const deletedRounds = await tx.gameSession.deleteMany({ where: sessions });
    // Leaderboard rows and badges go with the accounts (onDelete: Cascade).
    const deletedUsers = await tx.user.deleteMany({
      where: { id: { in: ids }, role: 'STUDENT', ...DEMO_USERS },
    });
    if (deletedUsers.count !== users.length || deletedRounds.count !== rounds) {
      throw new Error('The demo data changed while removing it; rolled back, nothing was deleted.');
    }
  }, TRANSACTION);
  console.log('\nRemoved.');
  return 0;
}

/* ---------- output ---------- */

function printSummary(
  plan: DemoPlan,
  categories: CatalogCategory[],
  questionLabels: Map<string, string>,
  seed: number,
): void {
  const completed = plan.sessions.filter((s) => s.status === 'COMPLETED');
  const tally = <T,>(items: T[], key: (item: T) => string) => {
    const m = new Map<string, number>();
    for (const item of items) m.set(key(item), (m.get(key(item)) ?? 0) + 1);
    return m;
  };
  const pct = (n: number, d: number) => `${d ? Math.round((n / d) * 100) : 0}%`;

  console.log(`\nDemo data plan (seed ${seed}, last ${DEMO_DAYS} days):`);
  const tiers = tally(plan.students, (s) => s.tier);
  const years = tally(plan.students, (s) => s.yearLevel);
  console.log(
    `  students:          ${plan.students.length} (strong ${tiers.get('strong') ?? 0}, average ${tiers.get('average') ?? 0}, weak ${tiers.get('weak') ?? 0}; ` +
      `${[...years].sort().map(([y, n]) => `${y} ${n}`).join(', ')})`,
  );
  console.log(`  rounds:            ${completed.length} completed, ${plan.sessions.length - completed.length} abandoned`);
  const perCategory = tally(completed, (s) => s.categoryId);
  for (const c of categories) console.log(`    ${c.name.padEnd(36)} ${perCategory.get(c.id) ?? 0}`);
  const perLevel = tally(completed, (s) => s.difficulty);
  console.log(`    by level: Easy ${perLevel.get('EASY') ?? 0}, Average ${perLevel.get('AVERAGE') ?? 0}, Difficult ${perLevel.get('DIFFICULT') ?? 0}`);

  const a = plan.answers;
  const correct = a.filter((x) => x.isCorrect).length;
  console.log(
    `  answers:           ${a.length} (correct ${pct(correct, a.length)}, hints ${a.filter((x) => x.hintUsed).length}, ` +
      `timeouts ${a.filter((x) => x.kind === 'timeout').length}, "I don't know" ${a.filter((x) => x.kind === 'dont_know').length})`,
  );
  console.log(`  leaderboard rows:  ${plan.leaderboard.length}`);
  const badgeCounts = tally(plan.badges, (b) => b.badgeCode);
  console.log(`  badges:            ${plan.badges.length} (${BADGES.map((b) => `${b.code} ${badgeCounts.get(b.code) ?? 0}`).join(', ')})`);
  const starts = plan.sessions.map((s) => s.startedAt.getTime());
  const ends = plan.sessions.map((s) => s.endedAt.getTime());
  console.log(`  dates (PH time):   ${manila(Math.min(...starts))} → ${manila(Math.max(...ends))}`);

  const byQuestion = new Map<string, { attempts: number; wrong: number }>();
  for (const x of a) {
    const t = byQuestion.get(x.questionId) ?? { attempts: 0, wrong: 0 };
    t.attempts += 1;
    if (!x.isCorrect) t.wrong += 1;
    byQuestion.set(x.questionId, t);
  }
  const missed = [...byQuestion]
    .filter(([, t]) => t.attempts >= 3 && t.wrong > 0)
    .sort(([, x], [, y]) => y.wrong / y.attempts - x.wrong / x.attempts || y.wrong - x.wrong)
    .slice(0, 5);
  console.log('  most missed (≥3 attempts):');
  for (const [id, t] of missed) console.log(`    ${questionLabels.get(id)}: ${t.wrong}/${t.attempts} wrong`);

  const points = new Map<string, number>();
  for (const s of completed) points.set(s.userId, (points.get(s.userId) ?? 0) + s.totalScore);
  const top = plan.students
    .map((s) => ({ s, p: points.get(s.id) ?? 0 }))
    .sort((x, y) => y.p - x.p)
    .slice(0, 5);
  console.log('  top players (all categories):');
  for (const { s, p } of top) console.log(`    ${s.fullName.padEnd(26)} ${String(p).padStart(5)} pts  ${s.email}`);
}

function manila(ms: number): string {
  return new Date(ms).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
}

/** Host and database name only; never the user name or password. */
function describeDatabase(url: string | undefined): string {
  if (!url) return '(DATABASE_URL is not set)';
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return '(unreadable DATABASE_URL)';
  }
}

let idCounter = 0;
/** cuid-like ids, so the new rows look like the API's. */
function newId(): string {
  idCounter += 1;
  return `c${Date.now().toString(36)}${idCounter.toString(36).padStart(4, '0')}${randomBytes(6).toString('hex')}`;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(`\nFailed, nothing was changed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
