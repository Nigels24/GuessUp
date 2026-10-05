import { describe, expect, it } from 'vitest';
import { AVATAR_MESSAGES, MAX_AVATAR_BYTES, avatarFileName, avatarFileProblem, isOwnAvatar } from './avatar.rules.js';

const file = (buffer: Buffer) => ({ buffer, size: buffer.length });
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);

describe('avatarFileProblem', () => {
  it('accepts JPG, PNG and WebP up to 2 MB', () => {
    for (const ok of [JPG, PNG, WEBP]) expect(avatarFileProblem(file(ok))).toBeNull();
    const exactly2MB = Buffer.concat([JPG, Buffer.alloc(MAX_AVATAR_BYTES - JPG.length)]);
    expect(avatarFileProblem(file(exactly2MB))).toBeNull();
  });
  it('needs a file', () => {
    expect(avatarFileProblem(undefined)).toBe(AVATAR_MESSAGES.missing);
    expect(avatarFileProblem(file(Buffer.alloc(0)))).toBe(AVATAR_MESSAGES.missing);
  });
  it('refuses anything over 2 MB', () => {
    expect(avatarFileProblem(file(Buffer.concat([JPG, Buffer.alloc(MAX_AVATAR_BYTES)])))).toBe(AVATAR_MESSAGES.tooLarge);
  });
  it('refuses SVG, GIF and other files, whatever their name', () => {
    for (const bad of ['<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'GIF89a', '%PDF-1.7', 'hello']) {
      expect(avatarFileProblem(file(Buffer.from(bad))), bad).toBe(AVATAR_MESSAGES.badType);
    }
  });
});

describe('avatar public ids', () => {
  it('names the file after the user and the upload time', () => {
    expect(avatarFileName('ck123', new Date(1_700_000_000_000))).toBe('user-ck123-1700000000000');
  });
  it("only treats the user's own photos in guessup/avatars as theirs", () => {
    expect(isOwnAvatar('guessup/avatars/user-ck123-1700000000000', 'ck123')).toBe(true);
    expect(isOwnAvatar('guessup/avatars/user-ck999-1700000000000', 'ck123')).toBe(false);
    expect(isOwnAvatar('guessup/questions/user-ck123-1', 'ck123')).toBe(false);
    expect(isOwnAvatar('THESIS/user-ck123-1', 'ck123')).toBe(false);
    expect(isOwnAvatar('guessup/avatars/user-ck123-1/../../../THESIS/x', 'ck123')).toBe(false);
  });
});
