/**
 * Gives existing students the 4 badges added after the prototype (Hot Streak,
 * Flawless, Subject Master, Grand Master) that their history already earns,
 * in the database of DATABASE_URL (api/.env). Each student is judged exactly
 * as at round finish (game/badge-stats.loader.ts + evaluateBadges).
 *
 *   npm run badges:backfill              # dry run (default): counts only, writes nothing
 *   npm run badges:backfill -- --apply   # writes the badges
 *
 * Run it after deploying the API that knows these badges: an older API skips
 * badge codes it does not know, so the rows are harmless before then but
 * invisible. Safe to run again: a badge a student holds is never added twice
 * (unique userId + badgeCode, skipDuplicates). Earned dates are the time of
 * the run. Old badges are not touched.
 */
import { PrismaClient } from '@prisma/client';
import { BADGES } from '../src/common/badges.js';
import { loadBadgeStats } from '../src/game/badge-stats.loader.js';
import { ACCOUNT_GROUPS, BACKFILL_CODES, accountGroup, backfillFor, type AccountGroup } from './badge-backfill/logic.js';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  console.log(apply ? 'APPLY mode: writing badges…' : 'Dry run (nothing is written). Pass --apply to write.');

  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: { id: true, email: true },
    orderBy: { createdAt: 'asc' },
  });

  const counts = new Map<string, Record<AccountGroup, number>>(
    BACKFILL_CODES.map((code) => [code, { real: 0, demo: 0, e2e: 0 }]),
  );
  const rows: { userId: string; badgeCode: string }[] = [];
  for (const student of students) {
    const { stats, held } = await loadBadgeStats(prisma, student.id);
    for (const code of backfillFor(stats, held)) {
      counts.get(code)![accountGroup(student.email)] += 1;
      rows.push({ userId: student.id, badgeCode: code });
    }
  }

  const groupTotals = ACCOUNT_GROUPS.map(
    (g) => `${g} ${students.filter((s) => accountGroup(s.email) === g).length}`,
  ).join(', ');
  console.log(`\nStudents checked: ${students.length} (${groupTotals})`);
  console.log('Students who would get each new badge:');
  for (const code of BACKFILL_CODES) {
    const badge = BADGES.find((b) => b.code === code)!;
    const c = counts.get(code)!;
    console.log(
      `  ${badge.icon} ${badge.name.padEnd(15)} real ${c.real}, demo ${c.demo}, e2e ${c.e2e}`,
    );
  }
  console.log(`Badge rows to add: ${rows.length}`);

  if (!apply) return;
  const { count } = await prisma.studentBadge.createMany({ data: rows, skipDuplicates: true });
  console.log(`\nAdded ${count} badge rows.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
