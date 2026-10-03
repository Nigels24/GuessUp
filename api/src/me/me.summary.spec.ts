import { BADGES } from '../common/badges.js';
import { buildSummary } from './me.summary.js';

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
        { categoryId: 'c1', name: 'Programming', roundsPlayed: 0, accuracy: 0, bestScore: 0 },
        { categoryId: 'c2', name: 'Networking', roundsPlayed: 0, accuracy: 0, bestScore: 0 },
        { categoryId: 'c3', name: 'Databases', roundsPlayed: 0, accuracy: 0, bestScore: 0 },
      ],
    });
  });

  it('totals points and rounds; accuracy is correct over answered items per category', () => {
    const summary = buildSummary(
      categories,
      [
        { categoryId: 'c1', totalScore: 40, correctCount: 3, totalItems: 5 },
        { categoryId: 'c1', totalScore: 65, correctCount: 5, totalItems: 5 },
        { categoryId: 'c3', totalScore: 12, correctCount: 1, totalItems: 3 },
      ],
      [],
    );
    expect(summary.totalPoints).toBe(117);
    expect(summary.roundsPlayed).toBe(3);
    expect(summary.perCategory).toEqual([
      { categoryId: 'c1', name: 'Programming', roundsPlayed: 2, accuracy: 80, bestScore: 65 },
      { categoryId: 'c2', name: 'Networking', roundsPlayed: 0, accuracy: 0, bestScore: 0 },
      { categoryId: 'c3', name: 'Databases', roundsPlayed: 1, accuracy: 33, bestScore: 12 },
    ]);
  });

  it('lists all 8 badges with their descriptions, earned or not', () => {
    const { allBadges } = buildSummary(categories, [], []);
    expect(allBadges).toHaveLength(8);
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
