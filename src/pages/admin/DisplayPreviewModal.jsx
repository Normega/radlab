// Full-display preview modal, shared by DisplaysPage (stored blocks) and
// DisplayEditorPage (unsaved editor state). Mimics DisplayStepWrapper's
// participant layout, with two deliberate differences: every block renders —
// condition-gated ones get a chip saying when they appear — and {{tokens}}
// stay literal, since preview has no session context to interpolate from.
import { useEffect } from 'react'
import DisplayMarkdown from '../../components/study/DisplayMarkdown'

export default function DisplayPreviewModal({ name, blocks, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const shown = (blocks ?? []).filter(b => (b.text ?? '').trim())

  return (
    <div style={M.overlay} onClick={onClose}>
      <div style={M.frame} onClick={e => e.stopPropagation()}>
        <div style={M.header}>
          <div>
            <p style={M.title}>{name || 'Untitled display'}</p>
            <p style={M.subtitle}>Preview — every block shown; {'{{variables}}'} resolve at runtime</p>
          </div>
          <button type="button" onClick={onClose} style={M.closeBtn}>✕ Close</button>
        </div>

        <div style={M.screen}>
          <div style={M.wrap}>
            {shown.map((block, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {block.showIf?.slot && (
                  <span style={M.chip}>
                    shown only if {block.showIf.slot} is {(block.showIf.in ?? []).join(' / ') || '(no arms listed)'}
                  </span>
                )}
                <DisplayMarkdown text={block.text} />
              </div>
            ))}
            {shown.length === 0 && (
              <p style={M.empty}>(No block has text yet — nothing to preview.)</p>
            )}
            <button type="button" style={M.continueBtn} disabled>Continue</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const M = {
  overlay:     { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' },
  frame:       { width: '100%', maxWidth: 760, maxHeight: '100%', display: 'flex', flexDirection: 'column' },
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  title:       { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 15, fontWeight: 600, color: '#fff', margin: '0 0 2px' },
  subtitle:    { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0 },
  closeBtn:    { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 14, color: '#fff', whiteSpace: 'nowrap' },
  screen:      { background: 'var(--bg, #fff)', borderRadius: 14, overflowY: 'auto' },
  // Mirrors DisplayStepWrapper's S.wrap so the preview is an honest rendering.
  wrap:        { padding: '48px 32px', maxWidth: 640, margin: '0 auto', fontFamily: '"DM Sans",system-ui,sans-serif', display: 'flex', flexDirection: 'column', gap: 20 },
  chip:        { alignSelf: 'flex-start', fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--pkd)', background: 'var(--bgc)', border: '1px solid var(--pkb)', borderRadius: 6, padding: '2px 8px' },
  empty:       { fontSize: 15, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif', margin: 0 },
  continueBtn: { alignSelf: 'center', marginTop: 12, background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 36px', fontSize: 15, fontWeight: 600, fontFamily: '"DM Sans",system-ui,sans-serif', opacity: 0.6, cursor: 'default' },
}
