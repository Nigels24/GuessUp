import { BADGES } from '../common/badges.js';
import type { CertificateRound } from '../common/certificates.js';
import { buildSummary } from './me.summary.js';

let next = 0;
/** A completed round; Easy unless given. */
const r = (over: Partial<CertificateRound>): CertificateRound => ({
  id: `s${++next}`,
  categoryId: 'c1',
  difficulty: 'EASY',
  status: 'COMPLETED',
  totalScore: 0,
  correctCount: 0,
  totalItems: 5,
  endedAt: new Date('2026-10-01T10:00:00Z'),
  ...over,
});
const NONE = { EASY: null, AVERAGE: null, DIFFICULT: null };

const categories = [
  { id: 'c1', name: 'Programming' },
  { id: 'c2', name: 'Networking' },
  { id: 'c3', name: 'Databases' },
];

describe('buildSummary', () => {
  it('lists every category, with zeros for those never played', () => {
    const summary = buildSummary(categories, [], []);
    expect(summary).toEqual({
      totalPoints: 0,
      roundsPlayed: 0,
      badges: [],
      allBadges: BADGES.map(({ code, icon, name, description }) => ({ code, icon, name, description })),
      perCategory: [
        { categoryId: 'c1', name: 'Programming', roundsPlayed: 0, accuracy: 0, bestScore: 0, bestStars: NONE },
        { categoryId: 'c2', name: 'Networking', roundsPlayed: 0, accuracy: 0, bestScore: 0, bestStars: NONE },
        { categoryId: 'c3', name: 'Databases', roundsPlayed: 0, accuracy: 0, bestScore: 0, bestStars: NONE },
      ],
      certificates: [],
    });
  });

  it('totals points and rounds; accuracy is correct over answered items per category', () => {
    const summary = buildSummary(
      categories,
      [
        r({ categoryId: 'c1', difficulty: 'AVERAGE', totalScore: 40, correctCount: 3, totalItems: 5 }),
        r({ categoryId: 'c1', totalScore: 65, correctCount: 5, totalItems: 5 }),
        r({ categoryId: 'c3', totalScore: 12, correctCount: 1, totalItems: 3 }),
      ],
      [],
    );
    expect(summary.totalPoints).toBe(117);
    expect(summary.roundsPlayed).toBe(3);
    expect(summary.perCategory).toEqual([
      {
        categoryId: 'c1',
        name: 'Programming',
        roundsPlayed: 2,
        accuracy: 80,
        bestScore: 65,
        bestStars: { EASY: 3, AVERAGE: 2, DIFFICULT: null },
      },
      { categoryId: 'c2', name: 'Networking', roundsPlayed: 0, accuracy: 0, bestScore: 0, bestStars: NONE },
      {
        categoryId: 'c3',
        name: 'Databases',
        roundsPlayed: 1,
        accuracy: 33,
        bestScore: 12,
        bestStars: { EASY: 0, AVERAGE: null, DIFFICULT: null },
      },
    ]);
    expect(summary.certificates).toEqual([]);
  });

  it('lists a certificate for each category with every level passed, dated by the last level to pass', () => {
    const summary = buildSummary(
      categories,
      [
        r({ categoryId: 'c2', difficulty: 'EASY', correctCount: 3, endedAt: new Date('2026-10-01T10:00:00Z') }),
        r({ categoryId: 'c2', difficulty: 'AVERAGE', correctCount: 4, endedAt: new Date('2026-10-02T10:00:00Z') }),
        r({ categoryId: 'c2', difficulty: 'DIFFICULT', correctCount: 3, endedAt: new Date('2026-10-03T10:00:00Z') }),
        // Programming: every level finished, but Average at 0 stars is not passed.
        r({ categoryId: 'c1', difficulty: 'EASY', correctCount: 5 }),
        r({ categoryId: 'c1', difficulty: 'AVERAGE' }),
        r({ categoryId: 'c1', difficulty: 'DIFFICULT', correctCount: 5 }),
      ],
      [],
    );
    expect(summary.certificates).toEqual([
      { categoryId: 'c2', name: 'Networking', completedAt: new Date('2026-10-03T10:00:00Z') },
    ]);
  });

  it('lists all 12 badges with their descriptions, earned or not', () => {
    const { allBadges } = buildSummary(categories, [], []);
    expect(allBadges).toHaveLength(12);
    expect(allBadges[0]).toEqual({
      code: 'first_round',
      icon: '🎉',
      name: 'First Steps',
      description: 'Finish your first round.',
    });
  });

  it('names badges from BADGES, oldest first, and skips unknown codes', () => {
    const later = new Date('2026-10-02T10:00:00Z');
    const earlier = new Date('2026-10-01T10:00:00Z');
    const summary = buildSummary(
      categories,
      [],
      [
        { badgeCode: 'perfect', earnedAt: later },
        { badgeCode: 'retired_badge', earnedAt: later },
        { badgeCode: 'first_round', earnedAt: earlier },
      ],
    );
    expect(summary.badges).toEqual([
      { code: 'first_round', icon: '🎉', name: 'First Steps', earnedAt: earlier },
      { code: 'perfect', icon: '💯', name: 'Perfect Round', earnedAt: later },
    ]);
  });
});
