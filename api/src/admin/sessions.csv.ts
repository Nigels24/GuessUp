/**
 * CSV export of Game Sessions: the filtered list, and one session with its
 * answers. Pure, unit tested. Uses the reports' toCsv (UTF-8 BOM, CRLF,
 * RFC 4180 quoting, formula cells neutralized).
 */
import type { SessionStatusKey } from './dto/session.dto.js';
import type { AdminSessionDetail, AdminSessionRow } from './admin-sessions.service.js';
import { toCsv } from './reports.csv.js';
import { LEVEL_LABELS, REPORT_UTC_OFFSET_HOURS, dayKey, type ReportRange } from './reports.logic.js';

export const STATUS_LABELS: Record<SessionStatusKey, string> = {
  COMPLETED: 'Completed',
  IN_PROGRESS: 'In progress',
  ABANDONED: 'Abandoned',
};

const OFFSET_MS = REPORT_UTC_OFFSET_HOURS * 3_600_000;

/** "2026-10-05 14:07" in Philippine time; empty for null. Sorts as text and Excel reads it as a date. */
export function phDateTime(at: Date | null): string {
  if (!at) return '';
  return new Date(at.getTime() + OFFSET_MS).toISOString().slice(0, 16).replace('T', ' ');
}

/** Correct answers are only final once the round is completed (the panel shows "—" otherwise). */
const correct = (s: Pick<AdminSessionRow, 'status' | 'correctCount'>) =>
  s.status === 'COMPLETED' ? s.correctCount : '';

/*
 * "Correct" and "Total items" are separate columns: a single "3/5" cell would
 * be read by Excel as a date (March 5).
 */
export const SESSION_COLUMNS = [
  'Student',
  'Email',
  'Category',
  'Difficulty',
  'Status',
  'Points',
  'Correct',
  'Total items',
  'Started at',
  'Finished at',
] as const;

export function sessionsCsv(rows: readonly AdminSessionRow[]): string {
  return toCsv([
    [...SESSION_COLUMNS],
    ...rows.map((s) => [
      s.user.fullName,
      s.user.email,
      s.category.name,
      LEVEL_LABELS[s.difficulty],
      STATUS_LABELS[s.status],
      s.totalScore,
      correct(s),
      s.totalItems,
      phDateTime(s.startedAt),
      phDateTime(s.endedAt),
    ]),
  ]);
}

/** The session's details as label/value rows, a blank row, then one row per answer. */
export function sessionDetailCsv(s: AdminSessionDetail): string {
  return toCsv([
    ['Student', s.user.fullName],
    ['Email', s.user.email],
    ['Category', s.category.name],
    ['Difficulty', LEVEL_LABELS[s.difficulty]],
    ['Status', STATUS_LABELS[s.status]],
    ['Started at', phDateTime(s.startedAt)],
    ['Finished at', phDateTime(s.endedAt)],
    ['Total points', s.totalScore],
    ['Correct', correct(s)],
    ['Total items', s.totalItems],
    ['Answered', s.answeredCount],
    [],
    ['#', 'Question', 'Student answer', 'Correct answer', 'Result', 'Points', 'Time taken (s)', 'Hint used'],
    ...s.answers.map((a) => [
      a.index,
      a.question.questionText,
      a.submitted,
      a.question.answer,
      a.isCorrect ? 'Correct' : 'Wrong',
      a.pointsEarned,
      a.timeTaken,
      a.hintUsed ? 'Yes' : 'No',
    ]),
  ]);
}

/** e.g. guessup_sessions_2026-10-01_to_2026-10-31.csv; an open end reads "start" / the export day. */
export function sessionsCsvFilename(range: Partial<Pick<ReportRange, 'from' | 'to'>>, now: Date): string {
  return `guessup_sessions_${range.from ?? 'start'}_to_${range.to ?? dayKey(now)}.csv`;
}

/** e.g. guessup_session_2026-10-05_juan-dela-cruz.csv (ASCII only, safe in a header). */
export function sessionCsvFilename(s: Pick<AdminSessionRow, 'startedAt' | 'user'>): string {
  const name = s.user.fullName
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `guessup_session_${dayKey(s.startedAt)}${name ? `_${name}` : ''}.csv`;
}
