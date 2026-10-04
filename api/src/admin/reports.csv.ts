/**
 * CSV export of the three reports (the prototype's "⬇ CSV" buttons). Pure,
 * unit tested. The files open correctly in Excel: UTF-8 with a byte order
 * mark, CRLF line endings, RFC 4180 quoting.
 */
import {
  LEVEL_LABELS,
  dayKey,
  TYPE_LABELS,
  type ActivityReport,
  type MostMissedReport,
  type ScoresReport,
} from './reports.logic.js';

export type Cell = string | number | null | undefined;

const BOM = '\uFEFF';

/**
 * One cell. Text that a spreadsheet would run as a formula (=, +, -, @ at the
 * start, e.g. a student named "=HYPERLINK(...)") gets a leading apostrophe.
 */
export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: readonly (readonly Cell[])[]): string {
  return BOM + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** A date as YYYY-MM-DD in Philippine time, for spreadsheets. */
const day = (at: Date | null): string => (at ? dayKey(at) : '');

export function activityCsv(report: ActivityReport): string {
  return toCsv([
    ['Rank', 'Student', 'Email', 'Year', 'Rounds', 'Points', 'Accuracy %', 'Last played'],
    ...report.players.map((p) => [
      p.rank,
      p.student.fullName,
      p.student.email,
      p.student.yearLevel,
      p.rounds,
      p.points,
      p.accuracy,
      day(p.lastPlayed),
    ]),
  ]);
}

export function scoresCsv(report: ScoresReport): string {
  return toCsv([
    ['Group', 'Name', 'Rounds', 'Average score', 'Accuracy %'],
    ...report.byCategory.map((r) => ['Category', r.category.name, r.rounds, r.avgScore, r.accuracy]),
    ...report.byDifficulty.map((r) => [
      'Difficulty',
      LEVEL_LABELS[r.difficulty],
      r.rounds,
      r.avgScore,
      r.accuracy,
    ]),
  ]);
}

export function mostMissedCsv(report: MostMissedReport): string {
  return toCsv([
    ['Question', 'Answer', 'Category', 'Topic', 'Type', 'Level', 'Attempts', 'Wrong', 'Wrong %'],
    ...report.items.map((m) => [
      m.question.questionText,
      m.question.answer,
      m.question.category.name,
      m.question.topic,
      TYPE_LABELS[m.question.type],
      LEVEL_LABELS[m.question.difficulty],
      m.attempts,
      m.wrong,
      m.wrongRate,
    ]),
  ]);
}

/** e.g. guessup_player_activity_2026-09-05_to_2026-10-04.csv */
export function csvFilename(report: string, range: { from: string; to: string }): string {
  return `guessup_${report}_${range.from}_to_${range.to}.csv`;
}
