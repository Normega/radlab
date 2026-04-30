/**
 * @param {{ points?: number } | null} profile
 * @returns {string[]}
 */
export function getUnlockedSpecies(profile) {
  if ((profile?.points ?? 0) >= 50) return ['human', 'wolf', 'dragon', 'cat', 'fish']
  return ['human']
}
