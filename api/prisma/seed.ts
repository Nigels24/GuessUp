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

  // 2. Questions (matched on category + question text so re-runs update in place)
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

    const existing = await prisma.question.findFirst({
      where: { categoryId, questionText: question.questionText },
      select: { id: true },
    });

    if (existing) {
      await prisma.question.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      await prisma.question.create({ data });
      created += 1;
    }
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
  console.log('Done.', totals);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
