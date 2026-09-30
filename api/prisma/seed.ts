/**
 * GuessUp database seed.
 *
 *   npm run prisma:seed          (or: npx prisma db seed)
 *
 * Loads the 7 subject categories and the 105 question items ported from the
 * approved prototype, plus one administrator and one student account.
 * The script is idempotent: running it twice leaves the same counts.
 */
import { PrismaClient, type Difficulty, type QuestionType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { categories } from './seed-data/categories.js';
import { questions } from './seed-data/questions.js';

const prisma = new PrismaClient();

const SEED_USERS = [
  {
    fullName: 'Prof. Admin Faculty',
    email: 'admin@jhcsc.edu.ph',
    password: 'admin123',
    role: 'ADMIN' as const,
    yearLevel: null,
  },
  {
    fullName: 'Juan Dela Cruz',
    email: 'student@jhcsc.edu.ph',
    password: 'student123',
    role: 'STUDENT' as const,
    yearLevel: '3rd Year',
  },
];

async function main(): Promise<void> {
  console.log('Seeding GuessUp database…');

  // 1. Categories (upsert on slug)
  const categoryIdBySlug = new Map<string, string>();
  for (const category of categories) {
    const saved = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        icon: category.icon,
        color: category.color,
        description: category.description,
      },
      create: category,
    });
    categoryIdBySlug.set(category.slug, saved.id);
  }
  console.log(`  categories: ${categoryIdBySlug.size}`);

  // 2. Questions (upsert on seedKey: some question texts repeat on purpose
  //    inside a category, so the text cannot identify an item)
  let created = 0;
  let updated = 0;
  for (const question of questions) {
    const categoryId = categoryIdBySlug.get(question.categorySlug);
    if (!categoryId) throw new Error(`Unknown category slug: ${question.categorySlug}`);

    const data = {
      categoryId,
      type: question.type as QuestionType,
      difficulty: question.difficulty as Difficulty,
      questionText: question.questionText,
      codeSnippet: question.codeSnippet,
      imageUrl: question.imageUrl,
      answer: question.answer,
      alternates: question.alternates,
      choices: question.choices,
      hint: question.hint,
      explanation: question.explanation,
      topic: question.topic,
      isActive: true,
    };

    const existing = await prisma.question.findUnique({
      where: { seedKey: question.seedKey },
      select: { id: true },
    });
    await prisma.question.upsert({
      where: { seedKey: question.seedKey },
      update: data,
      create: { seedKey: question.seedKey, ...data },
    });
    if (existing) updated += 1;
    else created += 1;
  }
  console.log(`  questions: ${created} created, ${updated} updated`);

  // 3. Accounts (passwords hashed with bcrypt, never stored in plain text)
  for (const user of SEED_USERS) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await prisma.user.upsert({
      where: { email: user.email },
      update: { fullName: user.fullName, role: user.role, yearLevel: user.yearLevel },
      create: {
        fullName: user.fullName,
        email: user.email,
        passwordHash,
        role: user.role,
        yearLevel: user.yearLevel,
      },
    });
  }
  console.log(`  users: ${SEED_USERS.length}`);

  const totals = {
    categories: await prisma.category.count(),
    questions: await prisma.question.count(),
    users: await prisma.user.count(),
  };
  await assertQuestionBank(totals);
  console.log('Done.', totals);
}

/**
 * Fails the seed loudly unless the bank is complete: 7 categories, 105 seeded
 * questions, and exactly 5 items for every category and difficulty pair.
 * A silent loss of items (as happened with repeated question texts) must
 * never go unnoticed again.
 */
async function assertQuestionBank(totals: { categories: number; questions: number }): Promise<void> {
  const DIFFICULTIES: Difficulty[] = ['EASY', 'AVERAGE', 'DIFFICULT'];
  const PER_PAIR = 5;
  const expectedQuestions = categories.length * DIFFICULTIES.length * PER_PAIR;
  const problems: string[] = [];

  if (totals.categories !== categories.length) {
    problems.push(`expected ${categories.length} categories, found ${totals.categories}`);
  }
  const seededQuestions = await prisma.question.count({ where: { seedKey: { not: null } } });
  if (seededQuestions !== expectedQuestions) {
    problems.push(`expected ${expectedQuestions} seeded questions, found ${seededQuestions}`);
  }

  const groups = await prisma.question.groupBy({
    by: ['categoryId', 'difficulty'],
    where: { seedKey: { not: null } },
    _count: { _all: true },
  });
  const saved = await prisma.category.findMany({ select: { id: true, slug: true } });
  const slugById = new Map(saved.map((c) => [c.id, c.slug]));
  for (const { slug } of categories) {
    for (const difficulty of DIFFICULTIES) {
      const group = groups.find(
        (g) => slugById.get(g.categoryId) === slug && g.difficulty === difficulty,
      );
      const count = group?._count._all ?? 0;
      if (count !== PER_PAIR) {
        problems.push(`${slug} / ${difficulty}: expected ${PER_PAIR} questions, found ${count}`);
      }
    }
  }

  if (problems.length) {
    throw new Error(`Seed check failed:\n  - ${problems.join('\n  - ')}`);
  }
  console.log(
    `  check passed: ${totals.categories} categories, ${seededQuestions} questions, ${PER_PAIR} per category and difficulty`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
