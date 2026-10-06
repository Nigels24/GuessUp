/**
 * Leaderboard layout (the prototype's #/s/leaderboard): the podium shows
 * ranks 1–3; a student ranked below 3rd gets their own row pinned under the
 * podium, so the list below leaves them out (the others keep their real rank
 * numbers). Tested by ranks.test.mjs (npm test).
 */
import type { RankingRow } from './game';

export interface BoardLayout {
  podium: RankingRow[];
  /** The student's own row, pinned under the podium; null in the top 3 or when not ranked. */
  pinned: RankingRow | null;
  /** Ranks 4 and up, without the student. */
  list: RankingRow[];
}

export function boardLayout(rows: readonly RankingRow[], me: RankingRow | null): BoardLayout {
  const pinned = me && me.rank > 3 ? me : null;
  return {
    podium: rows.slice(0, 3),
    pinned,
    list: rows.slice(3).filter((row) => !pinned || row.userId !== pinned.userId),
  };
}
