import { describe, expect, it } from 'vitest';
import type { AdminSessionDetail, AdminSessionRow } from './admin-sessions.service.js';
import {
  phDateTime,
  sessionCsvFilename,
  sessionDetailCsv,
  sessionsCsv,
  sessionsCsvFilename,
} from './sessions.csv.js';

const BOM = '﻿';
const lines = (csv: string) => csv.replace(BOM, '').split('\r\n').slice(0, -1);

const row = (over: Partial<AdminSessionRow> = {}): AdminSessionRow => ({
  id: 's1',
  user: { id: 'u1', fullName: 'Ana Omaña', email: 'ana@example.com', yearLevel: '3rd Year', avatarUrl: null },
  category: { id: 'c1', slug: 'net', name: 'Networking, Basics', icon: '🌐', color: '#000000' },
  difficulty: 'AVERAGE',
  status: 'COMPLETED',
  // 23:30 UTC is 07:30 the next day in the Philippines.
  startedAt: new Date('2026-10-04T23:30:00Z'),
  endedAt: new Date('2026-10-04T23:34:00Z'),
  totalScore: 320,
  correctCount: 4,
  totalItems: 5,
  accuracy: 80,
  timeSpent: 240,
  hintsUsed: 1,
  stars: 2,
  answeredCount: 5,
  ...over,
});

describe('phDateTime', () => {
  it('writes Philippine time as YYYY-MM-DD HH:mm, empty for null', () => {
    expect(phDateTime(new Date('2026-10-04T23:30:00Z'))).toBe('2026-10-05 07:30');
    expect(phDateTime(null)).toBe('');
  });
});

describe('sessionsCsv', () => {
  it('one row per session, with a BOM, quoting and labels', () => {
    const csv = sessionsCsv([row(), row({ status: 'ABANDONED', correctCount: 0, endedAt: null, user: { ...row().user, fullName: '=cmd()' } })]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(lines(csv)).toEqual([
      'Student,Email,Category,Difficulty,Status,Points,Correct,Total items,Started at,Finished at',
      'Ana Omaña,ana@example.com,"Networking, Basics",Average,Completed,320,4,5,2026-10-05 07:30,2026-10-05 07:34',
      // Correct is left empty for an unfinished round; a formula-like name is neutralized.
      "'=cmd(),ana@example.com,\"Networking, Basics\",Average,Abandoned,320,,5,2026-10-05 07:30,",
    ]);
  });

  it('header only when nothing matches', () => {
    expect(lines(sessionsCsv([]))).toHaveLength(1);
  });
});

describe('sessionDetailCsv', () => {
  it('lists the details, then every answer', () => {
    const detail: AdminSessionDetail = {
      ...row(),
      answers: [
        {
          index: 1,
          question: { id: 'q1', type: 'MULTIPLE_CHOICE', questionText: 'What is "DNS"?', answer: 'Domain Name System', topic: null },
          submitted: '-1',
          isCorrect: false,
          hintUsed: true,
          timeTaken: 12,
          pointsEarned: 0,
          createdAt: new Date('2026-10-04T23:31:00Z'),
        },
      ],
    };
    expect(lines(sessionDetailCsv(detail))).toEqual([
      'Student,Ana Omaña',
      'Email,ana@example.com',
      'Category,"Networking, Basics"',
      'Difficulty,Average',
      'Status,Completed',
      'Started at,2026-10-05 07:30',
      'Finished at,2026-10-05 07:34',
      'Total points,320',
      'Correct,4',
      'Total items,5',
      'Answered,5',
      '',
      '#,Question,Student answer,Correct answer,Result,Points,Time taken (s),Hint used',
      `1,"What is ""DNS""?",'-1,Domain Name System,Wrong,0,12,Yes`,
    ]);
  });
});

describe('filenames', () => {
  it('names the list by its period', () => {
    const now = new Date('2026-11-11T02:00:00Z');
    expect(sessionsCsvFilename({ from: '2026-10-01', to: '2026-10-31' }, now)).toBe(
      'guessup_sessions_2026-10-01_to_2026-10-31.csv',
    );
    expect(sessionsCsvFilename({}, now)).toBe('guessup_sessions_start_to_2026-11-11.csv');
  });

  it('names one session by its day and an ASCII form of the student name', () => {
    expect(sessionCsvFilename(row())).toBe('guessup_session_2026-10-05_ana-omana.csv');
    expect(sessionCsvFilename(row({ user: { ...row().user, fullName: '日本' } }))).toBe('guessup_session_2026-10-05.csv');
  });
});
