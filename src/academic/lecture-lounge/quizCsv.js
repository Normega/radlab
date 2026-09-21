// One row per respondent, one column per quiz item (item1..itemN in the
// config's order), values as stored — 0-indexed option positions. No
// profile ids and shuffled rows: the in-class analysis exercises promise
// students an anonymous table, and row order would otherwise leak who
// answered first.
export function quizResponsesCsv(items, answerRows, random = Math.random) {
  const rows = answerRows.map((answers) => items.map((it) => answers?.[it.id] ?? ''))
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]]
  }
  const header = items.map((_, i) => `item${i + 1}`).join(',')
  return [header, ...rows.map((r) => r.join(','))].join('\n') + '\n'
}
