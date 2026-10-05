/**
 * Builds the demo data for the defense (scripts/demo-seed.ts) without touching
 * the database: students, rounds, answers, leaderboard rows and badges. Pure
 * and deterministic for a given seed, so it is unit tested (plan.spec.ts).
 *
 * Nothing here re-implements a game rule. Every round is drawn with the API's
 * drawRound, every answer is judged and scored by its judgeAnswer (which uses
 * scoreAnswer and checkAnswer), round totals follow GameService.finish, and
 * badges come from evaluateBadges, evaluated after each round like the API
 * does. Only the student's behavior (who plays what, when, and how well) is
 * simulated.
 */
import {
  LEVELS,
  accuracyPercent,
  checkAnswer,
  type DifficultyKey,
  type QuestionTypeKey,
} from '../../src/common/game-rules.js';
import { badgeStats, evaluateBadges, type BadgeAnswer, type BadgeSession } from '../../src/common/badges.js';
import { drawRound, judgeAnswer, type RandomInt } from '../../src/game/game.logic.js';
import { dayKey, dayStart } from '../../src/admin/reports.logic.js';
import { YEAR_LEVELS } from '../../src/auth/auth.constants.js';

/** The only marker of demo data: every demo account's email ends with it. */
export const DEMO_EMAIL_DOMAIN = 'demo.jhcsc.edu.ph';

export function isDemoEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

/** How far back the rounds go. */
export const DEMO_DAYS = 21;

/* ---------- inputs and outputs ---------- */

export interface CatalogCategory {
  id: string;
  slug: string;
  name: string;
}

export interface CatalogQuestion {
  id: string;
  categoryId: string;
  difficulty: DifficultyKey;
  type: QuestionTypeKey;
  answer: string;
  alternates: string[];
  choices: string[];
}

export type Tier = 'strong' | 'average' | 'weak';

export interface DemoStudent {
  id: string;
  fullName: string;
  email: string;
  yearLevel: string;
  createdAt: Date;
  tier: Tier;
}

export interface DemoAnswer {
  id: string;
  sessionId: string;
  questionId: string;
  submitted: string;
  isCorrect: boolean;
  hintUsed: boolean;
  timeTaken: number;
  pointsEarned: number;
  createdAt: Date;
  /** For the summary only (not stored): how the simulated student answered. */
  kind: 'answered' | 'dont_know' | 'timeout';
}

export interface DemoSession {
  id: string;
  userId: string;
  categoryId: string;
  difficulty: DifficultyKey;
  status: 'COMPLETED' | 'ABANDONED';
  startedAt: Date;
  endedAt: Date;
  totalScore: number;
  correctCount: number;
  totalItems: number;
  accuracy: number;
  timeSpent: number;
  hintsUsed: number;
  itemIds: string[];
  currentIndex: number;
}

export interface DemoLeaderboardEntry {
  userId: string;
  categoryId: string;
  totalPoints: number;
  roundsPlayed: number;
}

export interface DemoBadge {
  userId: string;
  badgeCode: string;
  earnedAt: Date;
}

export interface DemoPlan {
  students: DemoStudent[];
  sessions: DemoSession[];
  answers: DemoAnswer[];
  leaderboard: DemoLeaderboardEntry[];
  badges: DemoBadge[];
}

export interface PlanInput {
  categories: CatalogCategory[];
  /** Active seeded questions (the pool the API would draw from). */
  questions: CatalogQuestion[];
  now: Date;
  seed: number;
  /** New row ids (cuid-like); injected so tests are deterministic. */
  newId: () => string;
}

/* ---------- the cast ---------- */

/** 25 students: [first name(s), last name, tier]. Emails are first.last@demo… */
const NAMES: [string, string, Tier][] = [
  ['Kristine Joy', 'Bautista', 'strong'],
  ['John Paul', 'Mendoza', 'average'],
  ['Angelica', 'Ramos', 'average'],
  ['Mark Anthony', 'Villanueva', 'strong'],
  ['Princess', 'Garcia', 'average'],
  ['Jerome', 'Santos', 'weak'],
  ['Rhea Mae', 'Fernandez', 'average'],
  ['Christian', 'Reyes', 'average'],
  ['Jasmine', 'Aquino', 'strong'],
  ['Kenneth', 'Torres', 'average'],
  ['Mary Grace', 'Lim', 'average'],
  ['Renz', 'Castillo', 'weak'],
  ['Nicole', 'Domingo', 'average'],
  ['Jayson', 'Pascual', 'average'],
  ['Erica', 'Navarro', 'strong'],
  ['Carlo', 'Manalo', 'average'],
  ['Shiela Mae', 'Ocampo', 'average'],
  ['Joshua', 'Salazar', 'weak'],
  ['Hazel', 'Cabrera', 'average'],
  ['Vincent', 'Tan', 'strong'],
  ['Lovely', 'Gonzales', 'average'],
  ['Ronald', 'Dizon', 'average'],
  ['Trisha Mae', 'Soriano', 'weak'],
  ['Kevin', 'Panganiban', 'average'],
  ['Alyssa', 'Robles', 'average'],
];

export function demoEmail(first: string, last: string): string {
  const part = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  return `${part(first)}.${part(last)}@${DEMO_EMAIL_DOMAIN}`;
}

/** Chance of a correct answer before the item and level are considered. */
const SKILL: Record<Tier, [number, number]> = {
  strong: [0.9, 0.97],
  average: [0.72, 0.82],
  weak: [0.5, 0.6],
};
/** Harder levels are missed more often. */
const LEVEL_PENALTY: Record<DifficultyKey, number> = { EASY: 0, AVERAGE: 0.1, DIFFICULT: 0.22 };
/** Which level a student picks. */
const LEVEL_CHOICE: Record<Tier, Record<DifficultyKey, number>> = {
  strong: { EASY: 0.36, AVERAGE: 0.38, DIFFICULT: 0.26 },
  average: { EASY: 0.55, AVERAGE: 0.32, DIFFICULT: 0.13 },
  weak: { EASY: 0.72, AVERAGE: 0.23, DIFFICULT: 0.05 },
};
/** Some subjects are played more than others. */
const CATEGORY_POPULARITY: Record<string, number> = {
  prog: 1.6,
  web: 1.4,
  dbms: 1.2,
  net: 1.0,
  dsa: 0.85,
  ias: 0.8,
  sad: 0.55,
};
/** Share of items left to run out, by tier. */
const TIMEOUT_RATE: Record<Tier, number> = { strong: 0.01, average: 0.03, weak: 0.06 };
/** Share of rounds left unfinished. */
const ABANDON_RATE = 0.035;
/** Rounds per day before jitter (Philippine calendar days). */
const WEEKDAY_ROUNDS = 10;
const WEEKEND_ROUNDS = 4;
const BUSY_DAYS = 3;
/** Relative activity per hour of the day, Philippine time: school hours, then evenings. */
const HOUR_WEIGHTS = [
  0.15, 0.05, 0, 0, 0, 0, 0.2, 0.5, 0.8, 0.8, 0.9, 0.9, 1.1, 0.9, 0.8, 0.8, 0.9, 1.0, 1.4, 1.8, 2.0,
  1.7, 1.0, 0.4,
];

/* ---------- randomness ---------- */

/** mulberry32: a small seeded PRNG, so a dry run and --apply with the same seed agree. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/* ---------- the plan ---------- */

export function buildDemoPlan(input: PlanInput): DemoPlan {
  const rnd = prng(input.seed);
  const rndInt: RandomInt = (max) => Math.floor(rnd() * max);
  const between = (lo: number, hi: number) => lo + rnd() * (hi - lo);
  const chance = (p: number) => rnd() < p;
  function weighted<T>(items: readonly T[], weight: (item: T) => number): T {
    const total = items.reduce((sum, item) => sum + weight(item), 0);
    let r = rnd() * total;
    for (const item of items) {
      r -= weight(item);
      if (r < 0) return item;
    }
    return items[items.length - 1]!;
  }

  const { categories, questions, now } = input;
  if (!categories.length || !questions.length) throw new Error('No categories or questions to play.');
  const byId = new Map(questions.map((q) => [q.id, q]));
  const pools = new Map(categories.map((c) => [c.id, questions.filter((q) => q.categoryId === c.id)]));

  // Some items are clearly harder: they top "most frequently answered incorrectly".
  const hardness = new Map(
    questions.map((q) => [q.id, chance(0.22) ? between(0.25, 0.42) : between(-0.06, 0.08)]),
  );

  /* students */
  const players = NAMES.map(([first, last, tier], i) => ({
    student: {
      id: input.newId(),
      fullName: `${first} ${last}`,
      email: demoEmail(first, last),
      yearLevel: YEAR_LEVELS[i % YEAR_LEVELS.length]!,
      createdAt: now, // set from the first round below
      tier,
    } satisfies DemoStudent,
    skill: between(...SKILL[tier]),
    // A few play a lot, most a little.
    activity: (chance(0.25) ? between(1.6, 2.3) : between(0.6, 1.3)) * (tier === 'weak' ? 0.75 : 1),
    favorites: new Set(
      categories.filter(() => chance(0.35)).map((c) => c.id),
    ),
  }));

  /* when rounds start: a daily rhythm over the last DEMO_DAYS days */
  const today = dayKey(now);
  const days = Array.from({ length: DEMO_DAYS }, (_, i) => dayKey(new Date(dayStart(today).getTime() - i * DAY)));
  const busy = new Set<string>();
  while (busy.size < BUSY_DAYS) busy.add(days[1 + rndInt(days.length - 1)]!);
  const latestStart = now.getTime() - 45 * MINUTE;
  const starts: { at: number; player: (typeof players)[number] }[] = [];
  for (const day of days) {
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    let count = (weekend ? WEEKEND_ROUNDS : WEEKDAY_ROUNDS) + rndInt(5) - 2;
    if (busy.has(day)) count *= 2;
    for (let i = 0; i < count; i++) {
      const hour = weighted(
        HOUR_WEIGHTS.map((w, h) => [h, w] as const),
        ([, w]) => w,
      )[0];
      const at = dayStart(day).getTime() + hour * HOUR + rndInt(60) * MINUTE + rndInt(60) * SECOND;
      if (at > latestStart) continue; // later today: not happened yet
      starts.push({ at, player: weighted(players, (p) => p.activity) });
    }
  }
  starts.sort((a, b) => a.at - b.at);

  /* play the rounds */
  const sessions: DemoSession[] = [];
  const answers: DemoAnswer[] = [];
  const busyUntil = new Map<string, number>();

  for (const start of starts) {
    const { player } = start;
    const me = player.student;
    // One round at a time per student (the API abandons a live round when a new one starts).
    let at = start.at;
    const free = busyUntil.get(me.id) ?? 0;
    if (at < free + MINUTE) at = free + between(1, 6) * MINUTE;
    if (at > latestStart) continue;

    const category = weighted(
      categories,
      (c) => (CATEGORY_POPULARITY[c.slug] ?? 1) * (player.favorites.has(c.id) ? 2.5 : 1),
    );
    const difficulty = weighted(['EASY', 'AVERAGE', 'DIFFICULT'] as const, (d) => LEVEL_CHOICE[me.tier][d]);
    const drawn = drawRound(pools.get(category.id) ?? [], difficulty, rndInt);
    if (!drawn.length) continue;

    const abandonAfter = chance(ABANDON_RATE) ? rndInt(Math.min(4, drawn.length)) : null;
    const level = LEVELS[difficulty];
    const sessionId = input.newId();
    const played: DemoAnswer[] = [];
    let clock = at; // the first item is served when the round starts

    for (const [i, item] of drawn.entries()) {
      if (abandonAfter !== null && i === abandonAfter) break;
      const question = byId.get(item.id)!;
      let p = player.skill - LEVEL_PENALTY[difficulty] - hardness.get(question.id)! + between(-0.05, 0.05);

      let kind: DemoAnswer['kind'] = 'answered';
      let hintUsed = false;
      if (chance(TIMEOUT_RATE[me.tier] + (difficulty === 'DIFFICULT' ? 0.02 : 0))) kind = 'timeout';
      else if (chance(Math.max(0, 1 - p) * 0.12)) kind = 'dont_know';
      else if (level.hints > 0 && chance(Math.max(0, 1 - p) * 0.3)) {
        hintUsed = true;
        p += 0.18;
      }
      const correct = kind === 'answered' && chance(Math.min(0.97, Math.max(0.05, p)));

      // Seconds from the item being served to the answer reaching the server.
      const limit = level.seconds;
      let seconds: number;
      if (kind === 'timeout') seconds = limit + between(0.2, 1.2); // the app sends when its timer ends
      else if (correct && chance(0.1)) seconds = between(2, 5); // knew it at once
      else {
        const [lo, hi] = correct
          ? { strong: [0.1, 0.45], average: [0.18, 0.65], weak: [0.3, 0.85] }[me.tier]
          : [0.3, 0.95];
        seconds = Math.max(2, limit * between(lo!, hi!) + (hintUsed ? 4 : 0));
      }
      if (kind !== 'timeout') seconds = Math.min(seconds, limit - 0.3);

      const submitted =
        kind === 'answered' ? (correct ? rightAnswer(question) : wrongAnswer(question)) : undefined;
      const judged = judgeAnswer({
        question,
        difficulty,
        submitted,
        elapsedMs: Math.round(seconds * SECOND),
        hintUsed,
      });
      clock += Math.round(seconds * SECOND);
      played.push({
        id: input.newId(),
        sessionId,
        questionId: question.id,
        submitted: judged.submitted,
        isCorrect: judged.isCorrect,
        hintUsed,
        timeTaken: judged.timeTaken,
        pointsEarned: judged.pointsEarned,
        createdAt: new Date(clock),
        kind,
      });
      // Reading the feedback and explanation; the next item is served after it.
      clock += Math.round(between(3, 14) * SECOND);
    }

    function rightAnswer(q: CatalogQuestion): string {
      if (q.type === 'MULTIPLE_CHOICE') return q.answer;
      const options = [q.answer, q.answer.toLowerCase(), ...q.alternates];
      return options[rndInt(options.length)]!;
    }
    function wrongAnswer(q: CatalogQuestion): string {
      const guesses =
        q.type === 'MULTIPLE_CHOICE'
          ? q.choices
          : (pools.get(q.categoryId) ?? []).filter((o) => o.id !== q.id && o.type === q.type).map((o) => o.answer);
      const options = guesses.filter((g) => !checkAnswer(q, g));
      // A typed answer with a letter missing, when the category has nothing else to confuse it with.
      return options.length ? options[rndInt(options.length)]! : q.answer.slice(0, -1) || '?';
    }

    const totalScore = played.reduce((sum, a) => sum + a.pointsEarned, 0);
    const lastAnswer = played.at(-1)?.createdAt.getTime() ?? at;
    if (abandonAfter !== null) {
      // As POST /answers then /abandon leave it: the score so far, nothing else totalled.
      const endedAt = lastAnswer + Math.round(between(5, 40) * SECOND);
      sessions.push({
        id: sessionId,
        userId: me.id,
        categoryId: category.id,
        difficulty,
        status: 'ABANDONED',
        startedAt: new Date(at),
        endedAt: new Date(endedAt),
        totalScore,
        correctCount: 0,
        totalItems: drawn.length,
        accuracy: 0,
        timeSpent: 0,
        hintsUsed: 0,
        itemIds: drawn.map((q) => q.id),
        currentIndex: played.length,
      });
      busyUntil.set(me.id, endedAt);
    } else {
      // As GameService.finish computes it.
      const correctCount = played.filter((a) => a.isCorrect).length;
      const endedAt = lastAnswer + Math.round(between(2, 6) * SECOND);
      sessions.push({
        id: sessionId,
        userId: me.id,
        categoryId: category.id,
        difficulty,
        status: 'COMPLETED',
        startedAt: new Date(at),
        endedAt: new Date(endedAt),
        totalScore,
        correctCount,
        totalItems: drawn.length,
        accuracy: accuracyPercent(correctCount, drawn.length),
        timeSpent: played.reduce((sum, a) => sum + a.timeTaken, 0),
        hintsUsed: played.filter((a) => a.hintUsed).length,
        itemIds: drawn.map((q) => q.id),
        currentIndex: drawn.length,
      });
      busyUntil.set(me.id, endedAt);
    }
    answers.push(...played);
  }

  /* drop students who never got a round; sign-up a little before the first one */
  const firstStart = new Map<string, number>();
  for (const s of sessions) if (!firstStart.has(s.userId)) firstStart.set(s.userId, s.startedAt.getTime());
  const students = players
    .map((p) => p.student)
    .filter((s) => firstStart.has(s.id))
    .map((s) => ({
      ...s,
      createdAt: new Date(firstStart.get(s.id)! - Math.round(between(0.3, 4) * DAY)),
    }));

  return {
    students,
    sessions,
    answers,
    leaderboard: leaderboardOf(sessions),
    badges: badgesOf(sessions, answers),
  };
}

/** One row per student and category, as GameService.finish accumulates it. */
export function leaderboardOf(sessions: DemoSession[]): DemoLeaderboardEntry[] {
  const rows = new Map<string, DemoLeaderboardEntry>();
  for (const s of sessions) {
    if (s.status !== 'COMPLETED') continue;
    const key = `${s.userId}|${s.categoryId}`;
    const row = rows.get(key) ?? { userId: s.userId, categoryId: s.categoryId, totalPoints: 0, roundsPlayed: 0 };
    row.totalPoints += s.totalScore;
    row.roundsPlayed += 1;
    rows.set(key, row);
  }
  return [...rows.values()];
}

/**
 * Badges as GameService.awardBadges gives them: after each completed round
 * (in time order), evaluateBadges over the student's completed rounds so far;
 * a badge is earned when that round ends.
 */
export function badgesOf(sessions: DemoSession[], answers: DemoAnswer[]): DemoBadge[] {
  const answersBySession = new Map<string, BadgeAnswer[]>();
  for (const a of answers) {
    const list = answersBySession.get(a.sessionId) ?? [];
    list.push({ isCorrect: a.isCorrect, timeTaken: a.timeTaken });
    answersBySession.set(a.sessionId, list);
  }
  const done = new Map<string, { sessions: BadgeSession[]; answers: BadgeAnswer[]; held: string[] }>();
  const badges: DemoBadge[] = [];
  const completed = sessions
    .filter((s) => s.status === 'COMPLETED')
    .sort((a, b) => a.endedAt.getTime() - b.endedAt.getTime());
  for (const s of completed) {
    const mine = done.get(s.userId) ?? { sessions: [], answers: [], held: [] };
    mine.sessions.push({
      categoryId: s.categoryId,
      difficulty: s.difficulty,
      accuracy: s.accuracy,
      hintsUsed: s.hintsUsed,
    });
    mine.answers.push(...(answersBySession.get(s.id) ?? []));
    for (const badge of evaluateBadges(badgeStats(mine.sessions, mine.answers), mine.held)) {
      mine.held.push(badge.code);
      badges.push({ userId: s.userId, badgeCode: badge.code, earnedAt: s.endedAt });
    }
    done.set(s.userId, mine);
  }
  return badges;
}
