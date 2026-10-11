// Unit tests for stars.ts, run by Node's own test runner (npm test).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allLevelsPassed, starSlots, starsA11y, starsLabel } from './stars.ts';

test('starSlots: filled first, always 3', () => {
  assert.deepEqual(starSlots(0), [false, false, false]);
  assert.deepEqual(starSlots(1), [true, false, false]);
  assert.deepEqual(starSlots(2), [true, true, false]);
  assert.deepEqual(starSlots(3), [true, true, true]);
});

test('starSlots: missing or out of range values are clamped', () => {
  assert.deepEqual(starSlots(null), [false, false, false]);
  assert.deepEqual(starSlots(undefined), [false, false, false]);
  assert.deepEqual(starSlots(5), [true, true, true]);
  assert.deepEqual(starSlots(-1), [false, false, false]);
  assert.deepEqual(starSlots(Number.NaN), [false, false, false]);
});

test('starsLabel: celebrates any star, encourages at zero', () => {
  assert.equal(starsLabel(3), '3 stars!');
  assert.equal(starsLabel(2), '2 stars!');
  assert.equal(starsLabel(1), '1 star!');
  assert.equal(starsLabel(0), 'Try again for a star');
});

test('starsA11y: reads the count, or says the level was never played', () => {
  assert.equal(starsA11y(2), '2 of 3 stars');
  assert.equal(starsA11y(0), '0 of 3 stars');
  assert.equal(starsA11y(null), 'Not played yet');
});

test('allLevelsPassed: 2 stars or more on every level', () => {
  assert.equal(allLevelsPassed({ EASY: 3, AVERAGE: 2, DIFFICULT: 2 }), true);
  assert.equal(allLevelsPassed({ EASY: 3, AVERAGE: 2, DIFFICULT: 1 }), false);
  assert.equal(allLevelsPassed({ EASY: 3, AVERAGE: null, DIFFICULT: 3 }), false);
  assert.equal(allLevelsPassed(undefined), false);
});
