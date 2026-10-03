import { buildProgress, type ProgressAnswer } from './me.progress.js';

const ref = (id: string, name: string) => ({ id, slug: id, name, icon: '📘', color: '#6C4CF1' });
const prog = ref('c1', 'Programming');
const net = ref('c2', 'Networking');
const db = ref('c3', 'Databases');
const categories = [prog, net, db];

const answer = (categoryId: string, topic: string | null, isCorrect: boolean): ProgressAnswer => ({
  categoryId,
  topic,
  isCorrect,
});

describe('buildProgress', () => {
  it('is empty with zeros before any completed round', () => {
    expect(buildProgress(categories, [], [], [])).toEqual({
      roundsPlayed: 0,
      totalPoints: 0,
      accuracy: 0,
      perCategory: [],
      topicsToReview: [],
      history: [],
    });
  });

  it('totals rounds, points and accuracy; lists only played categories, in category order', () => {
    const progress = buildProgress(
      categories,
      [
        { categoryId: 'c3', totalScore: 12, correctCount: 1, totalItems: 5 },
        { categoryId: 'c1', totalScore: 40, correctCount: 3, totalItems: 5 },
        { categoryId: 'c1', totalScore: 65, correctCount: 5, totalItems: 5 },
      ],
      [],
      [],
    );
    expect(progress).toMatchObject({ roundsPlayed: 3, totalPoints: 117, accuracy: 60 });
    expect(progress.perCategory).toEqual([
      { category: prog, roundsPlayed: 2, accuracy: 80, avgScore: 53 },
      { category: db, roundsPlayed: 1, accuracy: 20, avgScore: 12 },
    ]);
  });

  it('groups answers by category and topic, most missed first, missed-only, top 5', () => {
    const answers = [
      // Loops: missed 2 of 3.
      answer('c1', 'Loops', false),
      answer('c1', 'Loops', false),
      answer('c1', 'Loops', true),
      // Subnetting: missed 2 of 2 (same misses as Loops, higher rate, so first).
      answer('c2', 'Subnetting', false),
      answer('c2', 'Subnetting', false),
      // Same topic name in another category is a separate row.
      answer('c3', 'Loops', false),
      // Never missed: left out.
      answer('c1', 'Variables', true),
      // No topic: "General".
      answer('c3', null, false),
      answer('c3', '  ', true),
      answer('c2', 'OSI', false),
      answer('c2', 'IP', false),
      // Unknown category: skipped.
      answer('gone', 'Loops', false),
    ];
    const { topicsToReview } = buildProgress(categories, [], answers, []);
    expect(topicsToReview).toHaveLength(5);
    expect(topicsToReview.slice(0, 2)).toEqual([
      { category: net, topic: 'Subnetting', attempts: 2, correct: 0, wrong: 2 },
      { category: prog, topic: 'Loops', attempts: 3, correct: 1, wrong: 2 },
    ]);
    // Missed once out of once beats once out of twice; equal rates go by topic name.
    expect(topicsToReview.slice(2).map((t) => [t.category.id, t.topic])).toEqual([
      ['c2', 'IP'],
      ['c3', 'Loops'],
      ['c2', 'OSI'],
    ]);
    // "General" (missed 1 of 2) is sixth, so it falls outside the top 5.
    expect(topicsToReview.find((t) => t.topic === 'General')).toBeUndefined();
    expect(topicsToReview.find((t) => t.topic === 'Variables')).toBeUndefined();
  });

  it('names topic-less questions "General"', () => {
    const { topicsToReview } = buildProgress(
      categories,
      [],
      [answer('c3', null, false), answer('c3', '  ', true)],
      [],
    );
    expect(topicsToReview).toEqual([
      { category: db, topic: 'General', attempts: 2, correct: 1, wrong: 1 },
    ]);
  });

  it('passes the score history through unchanged', () => {
    const history = [
      {
        id: 's1',
        category: prog,
        difficulty: 'EASY' as const,
        totalScore: 40,
        accuracy: 60,
        correctCount: 3,
        totalItems: 5,
        endedAt: new Date('2026-10-01T10:00:00Z'),
      },
    ];
    expect(buildProgress(categories, [], [], history).history).toBe(history);
  });
});
