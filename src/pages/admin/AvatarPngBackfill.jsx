import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import RippleAvatar from '../../ripple/RippleAvatar'
import { uploadAvatarPng } from '../../lib/avatarPng'

/**
 * AvatarPngBackfill — one-time admin tool (2026-08-22).
 * Rasterizes every user's Ripple avatar to PNG in the avatar-png bucket, so
 * reminder emails can show the avatar. Save-time upload covers avatars saved
 * after this shipped; this page covers everyone who came before. Renders the
 * real RippleAvatar component one user at a time, so the raster can never
 * drift from the in-app avatar. Safe to re-run: upserts.
 */
export default function AvatarPngBackfill() {
  const [rows, setRows] = useState(null)        // all avatars rows
  const [existing, setExisting] = useState(null) // Set of "{uid}.png" already in bucket
  const [current, setCurrent] = useState(null)  // config being rendered right now
  const [log, setLog] = useState([])
  const [running, setRunning] = useState(false)
  const stageRef = useRef(null)
  const cancelRef = useRef(false)

  useEffect(() => {
    (async () => {
      const { data: avatars, error } = await supabase
        .from('avatars')
        .select('user_id, skin_color, eye_color, species, hair_style, hair_color')
        .order('user_id')
      if (error) { setLog(l => [...l, `load failed: ${error.message}`]); return }
      const { data: files, error: listErr } = await supabase.storage
        .from('avatar-png').list('', { limit: 10000 })
      if (listErr) { setLog(l => [...l, `bucket list failed: ${listErr.message}`]); return }
      setRows(avatars ?? [])
      setExisting(new Set((files ?? []).map(f => f.name)))
    })()
  }, [])

  async function run(onlyMissing) {
    if (!rows || running) return
    setRunning(true)
    cancelRef.current = false
    const todo = rows.filter(r => !onlyMissing || !existing.has(`${r.user_id}.png`))
    setLog(l => [...l, `— starting: ${todo.length} of ${rows.length} users —`])
    let ok = 0, fail = 0
    for (const r of todo) {
      if (cancelRef.current) { setLog(l => [...l, '— cancelled —']); break }
      setCurrent(r)
      // Two frames so React commits the new avatar into the stage before we read it
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)))
      const svg = stageRef.current?.querySelector('svg')
      const result = await uploadAvatarPng(svg, r.user_id)
      if (result.ok) { ok++; setExisting(s => new Set(s).add(`${r.user_id}.png`)) }
      else { fail++; setLog(l => [...l, `${r.user_id}: ${result.error}`]) }
    }
    setLog(l => [...l, `— done: ${ok} uploaded, ${fail} failed —`])
    setCurrent(null)
    setRunning(false)
  }

  const missing = rows && existing ? rows.filter(r => !existing.has(`${r.user_id}.png`)).length : null

  return (
    <div style={{ padding: 24, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <h1 style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 28, marginBottom: 8 }}>Avatar PNG backfill</h1>
      <p style={{ color: 'var(--tx2)', maxWidth: 640, marginBottom: 20 }}>
        Renders each user's Ripple avatar and uploads a PNG raster to the <code>avatar-png</code> bucket
        for reminder emails. New saves upload automatically; this covers existing users. Re-running is safe.
      </p>
      {rows === null ? <p>Loading avatar configs…</p> : (
        <>
          <p style={{ marginBottom: 16 }}>
            <strong>{rows.length}</strong> avatar configs · <strong>{missing}</strong> without a PNG
          </p>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <button disabled={running || missing === 0} onClick={() => run(true)} style={B}>Backfill missing ({missing})</button>
            <button disabled={running} onClick={() => run(false)} style={{ ...B, background: 'var(--bgc)', color: 'var(--pk)', border: '1px solid var(--pkbs)' }}>Re-render all ({rows.length})</button>
            {running && <button onClick={() => { cancelRef.current = true }} style={{ ...B, background: 'var(--gy)' }}>Cancel</button>}
          </div>
          {/* Live stage — visible so you can watch it work; the raster reads from here */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, minHeight: 120 }}>
            <div ref={stageRef} style={{ width: 112, height: 112 }}>
              {current && <RippleAvatar skinColor={current.skin_color} eyeColor={current.eye_color} species={current.species ?? 'human'} hairStyle={current.hair_style ?? 'none'} hairColor={current.hair_color ?? '#784421'} size={112} />}
            </div>
            {current && <code style={{ fontSize: 12, color: 'var(--tx2)' }}>{current.user_id}</code>}
          </div>
          <pre style={{ fontSize: 12, background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 8, padding: 12, maxHeight: 320, overflow: 'auto' }}>
            {log.join('\n') || 'idle'}
          </pre>
        </>
      )}
    </div>
  )
}

const B = {
  padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: 'var(--pk)', color: '#fff', fontWeight: 600, fontSize: 14,
}
