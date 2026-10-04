import { describe, expect, it } from 'vitest';
import { ME_RULE_MESSAGES as M, newPasswordProblem, profileProblem, samePasswordProblem } from './me.rules.js';

describe('profileProblem', () => {
  it('lets students change their year level, but not administrators', () => {
    expect(profileProblem('STUDENT', { yearLevel: '2nd Year' })).toBeNull();
    expect(profileProblem('ADMIN', { yearLevel: '2nd Year' })).toBe(M.noYearLevel);
    expect(profileProblem('ADMIN', {})).toBeNull();
  });
});

describe('newPasswordProblem', () => {
  it('needs at least 10 characters for administrators', () => {
    expect(newPasswordProblem('ADMIN', '123456789')).toBe(M.adminPasswordTooShort);
    expect(newPasswordProblem('ADMIN', '1234567890')).toBeNull();
  });
  it('leaves the student rule (8, checked by the DTO) as it is', () => {
    expect(newPasswordProblem('STUDENT', '12345678')).toBeNull();
  });
});

describe('samePasswordProblem', () => {
  it('administrators must choose a different password', () => {
    expect(samePasswordProblem('ADMIN', 'same-password-1', 'same-password-1')).toBe(M.samePassword);
    expect(samePasswordProblem('ADMIN', 'old-password-1', 'new-password-1')).toBeNull();
  });
  it('students keep the existing rule (no such check)', () => {
    expect(samePasswordProblem('STUDENT', 'same-password', 'same-password')).toBeNull();
  });
});
