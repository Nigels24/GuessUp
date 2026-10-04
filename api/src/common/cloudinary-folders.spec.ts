import { describe, expect, it } from 'vitest';
import { CLOUDINARY_FOLDERS, CLOUDINARY_ROOT, isInFolder } from './cloudinary-folders.js';

describe('Cloudinary folders', () => {
  it('keeps every GuessUp folder under guessup/', () => {
    expect(CLOUDINARY_ROOT).toBe('guessup');
    for (const path of Object.values(CLOUDINARY_FOLDERS)) expect(path.startsWith('guessup/')).toBe(true);
    expect(CLOUDINARY_FOLDERS.questions).toBe('guessup/questions');
  });

  it('only recognizes assets inside the given folder', () => {
    expect(isInFolder('guessup/questions/abc123', 'questions')).toBe(true);
    expect(isInFolder('guessup/questionsX/abc', 'questions')).toBe(false);
    expect(isInFolder('guessup/abc', 'questions')).toBe(false);
    expect(isInFolder('THESIS/photo', 'questions')).toBe(false);
    expect(isInFolder('samples/cloudinary-icon', 'questions')).toBe(false);
    expect(isInFolder('guessup/questions/../../THESIS/photo', 'questions')).toBe(false);
    expect(isInFolder('guessup/questions/a b', 'questions')).toBe(false);
  });
});
