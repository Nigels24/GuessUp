// Unit tests for ranks.ts, run by Node's own test runner (npm test).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boardLayout } from './ranks.ts';

const row = (rank, userId = `u${rank}`) => ({
  rank,
  userId,
  fullName: userId,
  avatarUrl: null,
  totalPoints: 1000 - rank,
  roundsPlayed: 2,
  accuracy: 80,
});
const rows = Array.from({ length: 12 }, (_, i) => row(i + 1));
const ranks = (list) => list.map((r) => r.rank);

test('a student ranked below 3rd is pinned once and left out of the list', () => {
  const me = rows[9]; // rank 10
  const { pinned, list } = boardLayout(rows, me);
  assert.equal(pinned, me);
  assert.deepEqual(ranks(list), [4, 5, 6, 7, 8, 9, 11, 12]);
});

test('a student in the top 3 is only on the podium', () => {
  const { podium, pinned, list } = boardLayout(rows, rows[1]);
  assert.equal(pinned, null);
  assert.deepEqual(ranks(podium), [1, 2, 3]);
  assert.deepEqual(ranks(list), [4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test('a student outside the top 50 rows is pinned; the list is unchanged', () => {
  const me = row(60, 'me');
  const { pinned, list } = boardLayout(rows, me);
  assert.equal(pinned, me);
  assert.equal(list.length, 9);
});

test('a student with no rounds here: nothing pinned', () => {
  const { pinned, list } = boardLayout(rows, null);
  assert.equal(pinned, null);
  assert.equal(list.length, 9);
  assert.deepEqual(boardLayout([], null), { podium: [], pinned: null, list: [] });
});
