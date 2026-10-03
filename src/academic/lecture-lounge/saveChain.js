// Run async work one at a time per key, in the order it was asked for.
//
// ClassTest saves each answer the moment it is given, and the server keeps the
// last write. Two saves of one question in flight together (tap B, then C a
// moment later) could commit out of order, leaving B graded while C showed as
// saved. Chaining per question makes the second request wait for the first;
// each link reads the latest answer when it runs, so the last one sent is
// always the student's final choice.
export function createSaveChain() {
  const tails = new Map()
  return {
    run(key, work) {
      const prev = tails.get(key) ?? Promise.resolve()
      // A failed link must not block the ones after it.
      const next = prev.catch(() => {}).then(() => work())
      tails.set(key, next)
      next.then(
        () => { if (tails.get(key) === next) tails.delete(key) },
        () => { if (tails.get(key) === next) tails.delete(key) },
      )
      return next
    },
    get size() { return tails.size },
  }
}
