// /resources/:slug: a display element published for anyone to read, signed in
// or not (displays.public, 20261008_public_displays.sql). The same blocks a
// session step shows, so a page linked from an email and the step can never
// drift apart. First use: a class trial's support list, linked from every one
// of its emails. Condition-gated blocks and {{variables}} need a session, so a
// public page shows only ungated blocks, as written.
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import DisplayMarkdown from '../components/study/DisplayMarkdown'

export default function PublicDisplay() {
  const { slug } = useParams()
  const [display, setDisplay] = useState(null)   // null loading · false missing · row

  useEffect(() => {
    let live = true
    supabase.from('displays').select('name, blocks').eq('slug', slug).eq('public', true).maybeSingle()
      .then(({ data, error }) => { if (live) setDisplay(error || !data ? false : data) })
    return () => { live = false }
  }, [slug])

  if (display === null) return <div style={S.page} />

  return (
    <div style={S.page}>
      <main style={S.card}>
        <img src="/RADlab_Logo.svg" alt="RADlab" style={S.logo} />
        {display === false
          ? <p style={S.missing}>This page isn’t available. Check that the whole link was copied.</p>
          : (display.blocks ?? []).filter(b => b?.type === 'text' && !b.showIf?.slot).map((b, i) => (
              <DisplayMarkdown key={i} text={b.text} />
            ))}
      </main>
    </div>
  )
}

const S = {
  page: { minHeight: '100vh', background: 'var(--bg)', padding: '24px 16px 48px', fontFamily: '"DM Sans", system-ui, sans-serif', color: 'var(--tx)' },
  card: { maxWidth: 680, margin: '0 auto', background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: 24 },
  logo: { height: 32, display: 'block', marginBottom: 16 },
  missing: { fontSize: 16, color: 'var(--tx2)', lineHeight: 1.5 },
}
