// A gap's ask is frequently a FRAGMENT of a longer annotation.
//
// The detector splits a "Needs research:" sentence on its semicolons, so one
// annotation becomes several gaps and the tail pieces arrive as orphans:
// "and Canadian diagnostic-delay data." is real text from the page, findable
// verbatim, and meaningless standing alone. 164 of 741 open gaps begin
// mid-sentence this way.
//
// page_gaps.ask_context holds the page line each ask was cut from — recovered
// mechanically, never authored. These helpers render the ask inside it, so the
// fragment is read where it sits. Shared by the gap board and the wiki page so
// a gap reads identically wherever it appears.

// The page line as prose: drop blockquote markers and bold, collapse space.
export const normContext = (c) =>
  String(c ?? '').replace(/^>\s*/gm, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()

// True when the context adds something the ask does not already say.
export const contextAdds = (context, ask) => {
  const c = normContext(context)
  return !!c && c !== String(ask ?? '').trim()
}

// The student's own piece, emphasised inside the sentence it came from.
export function highlightAsk(context, ask) {
  const needle = String(ask ?? '').trim().replace(/\s+/g, ' ')
  const at = context.indexOf(needle)
  if (at < 0 || !needle) return context
  return (
    <>
      {context.slice(0, at)}
      <mark style={{ background: 'rgba(214,51,132,.16)', color: 'inherit', padding: '0 2px', borderRadius: 3 }}>
        {context.slice(at, at + needle.length)}
      </mark>
      {context.slice(at + needle.length)}
    </>
  )
}
