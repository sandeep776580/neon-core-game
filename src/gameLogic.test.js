import test from 'node:test';
import assert from 'node:assert/strict';
import { addCrystalOnce, isPortalUnlocked, togglePauseState } from './gameLogic.js';

test('a crystal increments collection exactly once', () => {
  const first = addCrystalOnce([], 4);
  const repeated = addCrystalOnce(first, 4);
  assert.deepEqual(first, [4]);
  assert.equal(repeated, first);
});

test('portal unlocks only after all required crystals', () => {
  assert.equal(isPortalUnlocked(9, 10), false);
  assert.equal(isPortalUnlocked(10, 10), true);
});

test('pause toggles playing to paused and back without changing terminal states', () => {
  assert.equal(togglePauseState('playing'), 'paused');
  assert.equal(togglePauseState('paused'), 'playing');
  assert.equal(togglePauseState('victory'), 'victory');
});
