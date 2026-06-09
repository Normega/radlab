// 25 verified letter sets — each contains valid English words at lengths 4–8+.
// 5 are sampled without replacement per session.
export const LETTER_SETS = [
  { id:  1, letters: ['S','T','A','R','I','N','G','E','L','O'] },
  { id:  2, letters: ['C','R','E','A','M','I','N','T','S','P'] },
  { id:  3, letters: ['B','O','R','D','E','S','H','T','U','N'] },
  { id:  4, letters: ['P','L','A','N','E','T','C','H','I','G'] },
  { id:  5, letters: ['B','R','A','I','N','S','T','E','C','V'] },
  { id:  6, letters: ['R','O','P','E','S','T','A','L','I','N'] },
  { id:  7, letters: ['S','T','O','N','E','R','A','L','D','G'] },
  { id:  8, letters: ['W','I','N','E','S','P','A','L','C','H'] },
  { id:  9, letters: ['F','A','C','E','D','L','I','V','S','T'] },
  { id: 10, letters: ['G','R','O','U','N','D','S','T','E','H'] },
  { id: 11, letters: ['C','A','L','M','P','O','S','T','N','E'] },
  { id: 12, letters: ['S','L','A','V','E','R','T','O','N','D'] },
  { id: 13, letters: ['T','R','A','V','E','L','S','I','N','G'] },
  { id: 14, letters: ['M','O','N','S','T','E','R','I','N','G'] },
  { id: 15, letters: ['C','R','I','S','P','L','A','N','T','E'] },
  { id: 16, letters: ['D','A','N','G','E','R','O','U','S','T'] },
  { id: 17, letters: ['B','L','A','S','T','E','D','F','O','R'] },
  { id: 18, letters: ['C','H','A','R','M','I','N','G','S','T'] },
  { id: 19, letters: ['P','E','R','F','E','C','T','I','O','N'] },
  { id: 20, letters: ['A','M','B','I','T','I','O','N','S','E'] },
  { id: 21, letters: ['S','P','A','R','K','L','I','N','G','S'] },
  { id: 22, letters: ['W','O','N','D','E','R','F','U','L','Y'] },
  { id: 23, letters: ['C','O','M','P','L','E','T','I','N','G'] },
  { id: 24, letters: ['S','T','O','R','M','I','N','G','E','D'] },
  { id: 25, letters: ['C','L','E','A','N','S','T','O','R','M'] },
];

export function sampleSets(n = 5) {
  const shuffled = [...LETTER_SETS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
