import { describe, expect, it } from 'vitest';
import { activityCsv, csvCell, csvFilename, mostMissedCsv, scoresCsv, toCsv } from './reports.csv.js';
import type { ActivityReport, MostMissedReport, ScoresReport } from './reports.logic.js';

const BOM = '﻿';
const prog = { id: 'c1', slug: 'prog', name: 'Programming, Basics', icon: '💻', color: '#6C4CF1' };

describe('csvCell / toCsv', () => {
  it('quotes commas, quotes and line breaks (RFC 4180)', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(42)).toBe('42');
  });

  it('neutralizes text a spreadsheet would run as a formula', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+63 912')).toBe("'+63 912");
    expect(csvCell('@sum')).toBe("'@sum");
    expect(csvCell(-5)).toBe('-5'); // numbers are left alone
  });

  it('starts with a UTF-8 BOM and uses CRLF line endings', () => {
    expect(toCsv([['a', 'b'], [1, 'ñ']])).toBe(`${BOM}a,b\r\n1,ñ\r\n`);
  });
});

describe('report CSVs', () => {
  it('player activity', () => {
    const report = {
      from: '2026-09-05',
      to: '2026-10-04',
      players: [
        {
          rank: 1,
          student: { id: 'u', fullName: 'Dela Cruz, Juan', email: 'j@x', yearLevel: '1st Year' },
          rounds: 2,
          points: 90,
          accuracy: 80,
          lastPlayed: new Date('2026-10-03T23:30:00Z'),
        },
      ],
    } as unknown as ActivityReport;
    expect(activityCsv(report)).toBe(
      `${BOM}Rank,Student,Email,Year,Rounds,Points,Accuracy %,Last played\r\n1,"Dela Cruz, Juan",j@x,1st Year,2,90,80,2026-10-04\r\n`,
    );
  });

  it('average scores lists categories, then difficulties', () => {
    const report: ScoresReport = {
      from: 'a',
      to: 'b',
      byCategory: [{ category: prog, rounds: 2, avgScore: 51, accuracy: 80 }],
      byDifficulty: [{ difficulty: 'DIFFICULT', rounds: 0, avgScore: 0, accuracy: 0 }],
    };
    expect(scoresCsv(report).split('\r\n')).toEqual([
      `${BOM}Group,Name,Rounds,Average score,Accuracy %`,
      'Category,"Programming, Basics",2,51,80',
      'Difficulty,Difficult,0,0,0',
      '',
    ]);
  });

  it('most missed items', () => {
    const report = {
      items: [
        {
          question: {
            questionText: 'What is "x"?',
            answer: 'Variable',
            category: prog,
            topic: null,
            type: 'WORD_PUZZLE',
            difficulty: 'AVERAGE',
          },
          attempts: 4,
          wrong: 3,
          wrongRate: 75,
        },
      ],
    } as unknown as MostMissedReport;
    expect(mostMissedCsv(report).split('\r\n')[1]).toBe(
      '"What is ""x""?",Variable,"Programming, Basics",,Word Puzzle,Average,4,3,75',
    );
  });

  it('names files after the report and period', () => {
    expect(csvFilename('most_missed', { from: '2026-09-05', to: '2026-10-04' })).toBe(
      'guessup_most_missed_2026-09-05_to_2026-10-04.csv',
    );
  });
});
