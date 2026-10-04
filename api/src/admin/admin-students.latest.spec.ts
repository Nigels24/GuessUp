import { describe, expect, it } from 'vitest';
import { latest } from './admin-students.service.js';

describe('latest (the Students page "Last active")', () => {
  it('is the most recent time, ignoring missing ones', () => {
    const started = new Date('2026-10-04T01:00:00Z');
    const answered = new Date('2026-10-04T01:00:40Z');
    expect(latest(started, null, answered)).toBe(answered);
    expect(latest(undefined, started)).toBe(started);
  });
  it('is null when the student never played', () => {
    expect(latest(null, undefined, null)).toBeNull();
    expect(latest()).toBeNull();
  });
});
