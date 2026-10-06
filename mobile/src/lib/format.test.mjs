// Unit tests for format.ts, run by Node's own test runner (npm test).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { count } from './format.ts';

test('count: singular for exactly 1, plural otherwise', () => {
  assert.equal(count(1, 'round'), '1 round');
  assert.equal(count(0, 'round'), '0 rounds');
  assert.equal(count(2, 'round'), '2 rounds');
  assert.equal(count(11, 'item'), '11 items');
});

test('count: an irregular plural and a grouped number', () => {
  assert.equal(count(1, 'pt', 'pts'), '1 pt');
  assert.equal(count(1250, 'pt', 'pts'), '1,250 pts');
  assert.equal(count(1, 'category', 'categories'), '1 category');
  assert.equal(count(3, 'category', 'categories'), '3 categories');
});
