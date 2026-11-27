// Word Probe's letter board (studies.wordprobe_letter_board, 2026-11-27): each
// letter's best status across this word's guesses, so a letter that was green
// anywhere shows green even where another copy of it scored grey. The hook's
// `guesses` empties with each new word, so the board resets with it.
const RANK = { gray: 1, yellow: 2, green: 3 }

export const BOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

export function letterStates(guesses) {
  const out = {}
  for (const row of guesses ?? []) {
    for (const cell of row ?? []) {
      const { letter, status } = cell ?? {}
      if (!letter || !RANK[status]) continue
      if (!out[letter] || RANK[status] > RANK[out[letter]]) out[letter] = status
    }
  }
  return out
}
