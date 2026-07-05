// v1 — renders a display element (displays table) as a session step.
// Blocks are filtered by condition (showIf vs the participant's assignments)
// and {{variable}} placeholders interpolate from the session context:
// assignments (slot keys) + step outputs (slider.*, vas.*, game.*).
import { useQuery } from '@tanstack/react-query'
import { supabase as globalSupabase } from '../../lib/supabase'

/** Resolve 'game.aptitude_suite.avg_pct' against the context object. */
function resolvePath(ctx, path) {
  let cur = ctx
  for (const part of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = cur[part]
  }
  return cur
}

export function interpolate(text, ctx) {
  return (text ?? '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
    const v = resolvePath(ctx, path)
    return v === undefined || v === null ? '—' : String(v)
  })
}

export function blockVisible(block, assignments) {
  const showIf = block?.showIf
  if (!showIf || !showIf.slot) return true
  const arm = assignments?.[showIf.slot]
  return (showIf.in ?? []).includes(arm)
}

export default function DisplayStepWrapper({
  slug,
  assignments,
  stepOutputs,
  onComplete,
  supabaseClient,
  isSimMode = false,
}) {
  const db = supabaseClient ?? globalSupabase

  const { data: display, isLoading, error } = useQuery({
    queryKey: ['display', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await db.from('displays').select('*').eq('slug', slug).single()
      if (error) throw error
      return data
    },
  })

  if (isSimMode) {
    setTimeout(() => onComplete?.({ display_slug: slug }), 0)
    return <div style={S.loading}><span style={S.mono}>Sim mode — skipping display</span></div>
  }

  if (isLoading) return <div style={S.loading}>Loading…</div>
  if (error)     return <div style={S.err}>Could not load display "{slug}": {error.message}</div>
  if (!display)  return <div style={S.err}>Display "{slug}" not found.</div>

  const ctx = { ...(assignments ?? {}), ...(stepOutputs ?? {}) }
  const blocks = (display.blocks ?? []).filter(b => blockVisible(b, assignments))

  return (
    <div style={S.wrap}>
      {blocks.map((block, i) => {
        if (block.type !== 'text') return null // future block types render here
        return (
          <div key={i} style={S.textBlock}>
            {interpolate(block.text, ctx)}
          </div>
        )
      })}
      {blocks.length === 0 && (
        <p style={{ ...S.textBlock, color: 'var(--tx3)' }}>
          (No content for this condition.)
        </p>
      )}
      <button style={S.btn} onClick={() => onComplete?.({ display_slug: slug })}>
        Continue
      </button>
    </div>
  )
}

const S = {
  wrap:      { padding: '48px 32px', maxWidth: 640, margin: '0 auto', fontFamily: '"DM Sans",system-ui,sans-serif', display: 'flex', flexDirection: 'column', gap: 20 },
  textBlock: { fontSize: 17, color: 'var(--tx)', lineHeight: 1.65, whiteSpace: 'pre-wrap', margin: 0 },
  btn:       { alignSelf: 'center', marginTop: 12, background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 36px', fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  loading:   { padding: 40, textAlign: 'center', fontFamily: '"DM Sans",system-ui,sans-serif', color: 'var(--tx2)', fontSize: 15 },
  err:       { padding: 40, textAlign: 'center', fontFamily: '"DM Sans",system-ui,sans-serif', color: '#e04', fontSize: 14 },
  mono:      { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)' },
}
