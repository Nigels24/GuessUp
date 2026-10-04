/**
 * GuessUp database seed.
 *
 *   npm run prisma:seed          (or: npx prisma db seed)
 *
 * Loads the 7 subject categories and the 105 question items ported from the
 * approved prototype, plus one administrator and one demo student account
 * (taken from SEED_* environment variables; see SEED_USERS).
 * The script is idempotent: running it twice leaves the same counts.
 */
import { PrismaClient, type Difficulty, type QuestionType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '../src/auth/auth.constants.js';
import { categories } from './seed-data/categories.js';
import { questions } from './seed-data/questions.js';

const prisma = new PrismaClient();

/**
 * Seeded accounts. Emails and passwords come from the environment (api/.env or
 * the shell), never from this file, because the repository is public:
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD     (password: at least 10 characters)
 *   SEED_STUDENT_EMAIL, SEED_STUDENT_PASSWORD (password: at least 8, like registration)
 * An account that already exists keeps its password; only its name, role and
 * year level are updated. An account that does not exist yet is created only
 * when its email and password are set; otherwise it is skipped with a message.
 */
const SEED_USERS = [
  {
    label: 'administrator',
    fullName: 'Prof. Admin Faculty',
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
    minLength: 10,
    emailVar: 'SEED_ADMIN_EMAIL',
    passwordVar: 'SEED_ADMIN_PASSWORD',
    role: 'ADMIN' as const,
    yearLevel: null,
  },
  {
    label: 'demo student',
    fullName: 'Juan Dela Cruz',
    email: process.env.SEED_STUDENT_EMAIL,
    password: process.env.SEED_STUDENT_PASSWORD,
    minLength: 8,
    emailVar: 'SEED_STUDENT_EMAIL',
    passwordVar: 'SEED_STUDENT_PASSWORD',
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
      // isActive is left out on purpose: new items start active (schema
      // default), and an item an administrator deactivated stays deactivated.
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
    const email = user.email?.trim().toLowerCase();
    if (!email) {
      console.log(`  ${user.label}: skipped (${user.emailVar} is not set)`);
      continue;
    }
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      // Never touch the password of an existing account.
      await prisma.user.update({
        where: { id: existing.id },
        data: { fullName: user.fullName, role: user.role, yearLevel: user.yearLevel },
      });
      console.log(`  ${user.label}: exists, password unchanged`);
      continue;
    }
    if (!user.password) {
      console.log(`  ${user.label}: not created (${user.passwordVar} is not set; no default password is used)`);
      continue;
    }
    if (user.password.length < user.minLength) {
      console.log(`  ${user.label}: not created (${user.passwordVar} must be at least ${user.minLength} characters)`);
      continue;
    }
    await prisma.user.create({
      data: {
        fullName: user.fullName,
        email,
        passwordHash: await bcrypt.hash(user.password, BCRYPT_ROUNDS),
        role: user.role,
        yearLevel: user.yearLevel,
      },
    });
    console.log(`  ${user.label}: created`);
  }

  const totals = {
    categories: await prisma.category.count(),
    questions: await prisma.question.count(),
    users: await prisma.user.count(),
  };
  await assertQuestionBank();
  console.log('Done.', totals);
}

/**
 * Fails the seed loudly unless the bank is complete: the 7 seeded categories,
 * 105 seeded questions, and exactly 5 items for every category and difficulty
 * pair. A silent loss of items (as happened with repeated question texts) must
 * never go unnoticed again. Categories and questions added in the Admin Panel
 * are not counted, so re-running the seed keeps working after admins add some.
 */
async function assertQuestionBank(): Promise<void> {
  const DIFFICULTIES: Difficulty[] = ['EASY', 'AVERAGE', 'DIFFICULT'];
  const PER_PAIR = 5;
  const expectedQuestions = categories.length * DIFFICULTIES.length * PER_PAIR;
  const problems: string[] = [];

  const seededCategories = await prisma.category.count({
    where: { slug: { in: categories.map((c) => c.slug) } },
  });
  if (seededCategories !== categories.length) {
    problems.push(`expected ${categories.length} seeded categories, found ${seededCategories}`);
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
    `  check passed: ${seededCategories} categories, ${seededQuestions} questions, ${PER_PAIR} per category and difficulty`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
