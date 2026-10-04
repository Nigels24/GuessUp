import { describe, expect, it } from 'vitest';
import { QUESTION_MESSAGES as M, checkQuestion, type QuestionInput } from './question.rules.js';

const base = {
  categoryId: 'cat1',
  difficulty: 'EASY',
  questionText: '  A named storage location.  ',
  explanation: 'It holds a value.',
} as const;

const mc = (over: Partial<QuestionInput> = {}): QuestionInput => ({
  ...base,
  type: 'MULTIPLE_CHOICE',
  answer: 'Variable',
  choices: ['Constant', 'Function', 'Keyword'],
  ...over,
});
const picture = (over: Partial<QuestionInput> = {}): QuestionInput => ({
  ...base,
  type: 'PICTURE',
  answer: 'Star topology',
  imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/guessup/questions/abc.png',
  imagePublicId: 'guessup/questions/abc',
  ...over,
});
const puzzle = (over: Partial<QuestionInput> = {}): QuestionInput => ({
  ...base,
  type: 'WORD_PUZZLE',
  answer: 'linked   list',
  ...over,
});

describe('checkQuestion', () => {
  it('accepts a complete multiple-choice item and trims it', () => {
    const { data, errors } = checkQuestion(mc({ hint: '  ', topic: ' Variables ' }));
    expect(errors).toEqual([]);
    expect(data.questionText).toBe('A named storage location.');
    expect(data.hint).toBeNull();
    expect(data.topic).toBe('Variables');
    expect(data.isActive).toBe(true);
  });

  it('requires question, answer and explanation', () => {
    const { errors } = checkQuestion(mc({ questionText: ' ', answer: '', explanation: '' }));
    expect(errors).toEqual(expect.arrayContaining([M.questionRequired, M.answerRequired, M.explanationRequired]));
  });

  it('refuses a hint on Difficult (LEVELS has no hints there) but allows it on Easy/Average', () => {
    expect(checkQuestion(mc({ difficulty: 'DIFFICULT', hint: 'Starts with V' })).errors).toContain(M.noHintOnDifficult);
    expect(checkQuestion(mc({ difficulty: 'DIFFICULT', hint: '' })).errors).toEqual([]);
    expect(checkQuestion(mc({ difficulty: 'AVERAGE', hint: 'Starts with V' })).errors).toEqual([]);
  });

  describe('multiple choice', () => {
    it('needs exactly 3 non-empty wrong options', () => {
      expect(checkQuestion(mc({ choices: ['A', 'B'] })).errors).toContain(M.mcNeedsDistractors);
      expect(checkQuestion(mc({ choices: ['A', 'B', 'C', 'D'] })).errors).toContain(M.mcNeedsDistractors);
      expect(checkQuestion(mc({ choices: ['A', ' ', 'C'] })).errors).toContain(M.mcNeedsDistractors);
      expect(checkQuestion(mc({ choices: undefined })).errors).toContain(M.mcNeedsDistractors);
    });

    it('needs 4 different options, the answer included, ignoring case', () => {
      expect(checkQuestion(mc({ choices: ['variable', 'Function', 'Keyword'] })).errors).toContain(M.mcOptionsUnique);
      expect(checkQuestion(mc({ choices: ['Constant', 'Constant ', 'Keyword'] })).errors).toContain(M.mcOptionsUnique);
    });

    it('clears fields that do not apply: alternates and the image', () => {
      const { data } = checkQuestion(mc({ alternates: ['var'], imageUrl: 'https://x/y.png', imagePublicId: 'guessup/questions/y' }));
      expect(data.alternates).toEqual([]);
      expect(data.imageUrl).toBeNull();
      expect(data.imagePublicId).toBeNull();
    });
  });

  describe('picture', () => {
    it('needs an image', () => {
      expect(checkQuestion(picture({ imageUrl: null, imagePublicId: null })).errors).toContain(M.pictureNeedsImage);
    });

    it('accepts https uploads and seeded /static/images pictures, nothing else', () => {
      expect(checkQuestion(picture()).errors).toEqual([]);
      expect(checkQuestion(picture({ imageUrl: '/static/images/star.svg', imagePublicId: null })).errors).toEqual([]);
      expect(checkQuestion(picture({ imageUrl: 'javascript:alert(1)' })).errors).toContain(M.badImageUrl);
      expect(checkQuestion(picture({ imageUrl: 'http://example.com/a.png' })).errors).toContain(M.badImageUrl);
      expect(checkQuestion(picture({ imageUrl: '/static/../secret' })).errors).toContain(M.badImageUrl);
    });

    it('only accepts public ids inside the GuessUp folder', () => {
      expect(checkQuestion(picture({ imagePublicId: 'someone-else/photo' })).errors).toContain(M.badImagePublicId);
    });

    it('keeps alternates trimmed and unique, and clears choices', () => {
      const { data, errors } = checkQuestion(picture({ alternates: [' star ', 'Star', '', 'star network'], choices: ['x'] }));
      expect(errors).toEqual([]);
      expect(data.alternates).toEqual(['star', 'star network']);
      expect(data.choices).toEqual([]);
    });

    it('limits alternates and refuses ones that cannot be typed', () => {
      expect(checkQuestion(picture({ alternates: ['a', 'b', 'c', 'd', 'e', 'f'] })).errors).toContain(M.tooManyAlternates);
      expect(checkQuestion(picture({ alternates: ['???'] })).errors).toContain(M.alternateNeedsLetter);
    });
  });

  describe('word puzzle', () => {
    it('accepts letters and spaces, collapsing repeated spaces', () => {
      const { data, errors } = checkQuestion(puzzle());
      expect(errors).toEqual([]);
      expect(data.answer).toBe('linked list');
    });

    it('refuses digits and symbols', () => {
      expect(checkQuestion(puzzle({ answer: 'TCP/IP' })).errors).toContain(M.puzzleLettersOnly);
      expect(checkQuestion(puzzle({ answer: 'IPv4' })).errors).toContain(M.puzzleLettersOnly);
    });

    it('needs 2 to 16 letters (spaces do not count)', () => {
      expect(checkQuestion(puzzle({ answer: 'A' })).errors).toContain(M.puzzleLength);
      expect(checkQuestion(puzzle({ answer: 'abcdefgh ijklmnop' })).errors).toEqual([]);
      expect(checkQuestion(puzzle({ answer: 'abcdefgh ijklmnopq' })).errors).toContain(M.puzzleLength);
    });
  });

  it('an answer made only of symbols can never be typed', () => {
    expect(checkQuestion(picture({ answer: '!!!' })).errors).toContain(M.answerNeedsLetter);
  });
});
