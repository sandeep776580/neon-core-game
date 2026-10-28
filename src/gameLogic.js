export function addCrystalOnce(collected, crystalIndex) {
  if (collected.includes(crystalIndex)) return collected;
  return [...collected, crystalIndex];
}

export function togglePauseState(state) {
  if (state === 'playing') return 'paused';
  if (state === 'paused') return 'playing';
  return state;
}

export function isPortalUnlocked(collected, required) {
  return collected >= required;
}
