import { describe, expect, it } from 'vitest';
import { CLOUDINARY_FOLDERS, CLOUDINARY_INCOMING, CLOUDINARY_ROOT, isInFolder } from './cloudinary-folders.js';

describe('Cloudinary folders', () => {
  it('keeps every GuessUp folder under guessup/', () => {
    expect(CLOUDINARY_ROOT).toBe('guessup');
    for (const path of Object.values(CLOUDINARY_FOLDERS)) expect(path.startsWith('guessup/')).toBe(true);
    expect(CLOUDINARY_FOLDERS.questions).toBe('guessup/questions');
    expect(CLOUDINARY_FOLDERS.avatars).toBe('guessup/avatars');
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

  it('keeps profile photos and question pictures apart', () => {
    expect(isInFolder('guessup/avatars/user-ck1-1700000000000', 'avatars')).toBe(true);
    expect(isInFolder('guessup/avatars/user-ck1-1', 'questions')).toBe(false);
    expect(isInFolder('guessup/questions/abc123', 'avatars')).toBe(false);
    expect(isInFolder('guessup/avatarsX/abc', 'avatars')).toBe(false);
    expect(isInFolder('guessup/avatars/../questions/abc', 'avatars')).toBe(false);
  });

  it('resizes on upload: photos to a 512 px square, question pictures to at most 1280 px', () => {
    expect(CLOUDINARY_INCOMING.avatars).toMatchObject({ width: 512, height: 512, crop: 'fill', gravity: 'auto', quality: 'auto' });
    expect(CLOUDINARY_INCOMING.questions).toMatchObject({ width: 1280, height: 1280, crop: 'limit', quality: 'auto' });
    // f_auto is not allowed in an incoming transformation; it is added to the delivery URL instead.
    for (const t of Object.values(CLOUDINARY_INCOMING)) expect(t).not.toHaveProperty('fetch_format');
  });
});
