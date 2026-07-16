import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

const SITE_ROOT = import.meta.env.DEV ? window.location.origin : 'https://radlab.zone'

function useLinks(studyId) {
  return useQuery({
    queryKey: ['anon-links', studyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('participant_links')
        .select(`
          id, token, status, created_at, expires_at,
          participant_schedule!schedule_id(id, status, completed_at),
          profiles!participant_id(id, display_name, sona_id, is_anonymous)
        `)
        .eq('study_id', studyId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export default function AnonymousLinkPanel({ study, qc }) {
  const studyId = study.id

  const { data: links = [], isLoading } = useLinks(studyId)
  const [sonaId,   setSonaId]   = useState('')
  const [genError, setGenError] = useState(null)
  const [copied,   setCopied]   = useState(null)

  async function callEdgeFunction(sonaIdValue) {
    const { data: { session } } = await supabase.auth.getSession()
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create_anonymous_participant`,
      {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ studyId, sonaId: sonaIdValue || null }),
      }
    )
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}))
      throw new Error(body.error ?? `Server error ${resp.status}`)
    }
    return resp.json()
  }

  const generateLink = useMutation({
    mutationFn: () => callEdgeFunction(null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['anon-links', studyId] })
      setGenError(null)
    },
    onError: (e) => setGenError(e.message),
  })

  const generateSonaLink = useMutation({
    mutationFn: () => {
      const id = sonaId.trim()
      if (!id) throw new Error('Enter a SONA participant ID.')
      return callEdgeFunction(id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['anon-links', studyId] })
      setSonaId('')
      setGenError(null)
    },
    onError: (e) => setGenError(e.message),
  })

  const revokeLink = useMutation({
    mutationFn: async (linkId) => {
      const { error } = await supabase
        .from('participant_links')
        .update({ status: 'revoked' })
        .eq('id', linkId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['anon-links', studyId] }),
  })

  function copyLink(token) {
    navigator.clipboard.writeText(`${SITE_ROOT}/s/${token}`)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  const isPending = generateLink.isPending || generateSonaLink.isPending

  return (
    <div style={{ marginTop: 36 }}>
      <h2 style={S.sectionTitle}>Participant links</h2>

      <div style={S.generateRow}>
        {/* Anonymous link */}
        <div style={S.generateCard}>
          <div style={S.cardLabel}>Anonymous participant</div>
          <button
            style={{ ...S.btnPrimary, opacity: isPending ? 0.7 : 1 }}
            onClick={() => { setGenError(null); generateLink.mutate() }}
            disabled={isPending}
          >
            {generateLink.isPending ? 'Generating…' : 'Generate link'}
          </button>
        </div>

        {/* SONA import */}
        <div style={S.generateCard}>
          <div style={S.cardLabel}>SONA participant</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ ...S.input, flex: 1 }}
              placeholder="SONA ID"
              value={sonaId}
              onChange={e => setSonaId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generateSonaLink.mutate()}
            />
            <button
              style={{ ...S.btnPrimary, opacity: isPending ? 0.7 : 1 }}
              onClick={() => { setGenError(null); generateSonaLink.mutate() }}
              disabled={isPending}
            >
              {generateSonaLink.isPending ? 'Creating…' : 'Create link'}
            </button>
          </div>
        </div>
      </div>

      {genError && <p style={S.errMsg}>{genError}</p>}

      {isLoading ? (
        <p style={S.muted}>Loading…</p>
      ) : links.length === 0 ? (
        <div style={S.empty}>
          <p style={S.emptyText}>No links generated yet.</p>
        </div>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Participant', 'Created', 'Status', 'Expires', 'Link', ''].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {links.map(l => {
                const profile   = l.profiles
                const label     = profile?.sona_id ? `SONA-${profile.sona_id}` : (profile?.id?.slice(0, 8) ?? '—')
                const isRevoked = l.status === 'revoked'
                const isUsed    = l.status === 'used'
                const url       = `${SITE_ROOT}/s/${l.token}`
                return (
                  <tr key={l.id} style={{ ...S.tr, opacity: isRevoked ? 0.5 : 1 }}>
                    <td style={S.td}><span style={S.mono}>{label}</span></td>
                    <td style={S.td}><span style={S.mono}>{fmtDate(l.created_at)}</span></td>
                    <td style={S.td}><StatusBadge status={l.status} /></td>
                    <td style={S.td}><span style={S.mono}>{fmtDate(l.expires_at)}</span></td>
                    <td style={S.td}>
                      {!isRevoked && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ ...S.mono, fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {url}
                          </span>
                          <button style={S.copyBtn} onClick={() => copyLink(l.token)}>
                            {copied === l.token ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      )}
                    </td>
                    <td style={S.td}>
                      {!isRevoked && !isUsed && (
                        <button
                          style={S.revokeBtn}
                          onClick={() => { if (window.confirm('Revoke this link?')) revokeLink.mutate(l.id) }}
                          disabled={revokeLink.isPending}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    active:  { bg: '#f0fdf4', color: '#15803d' },
    used:    { bg: '#eff6ff', color: '#1d4ed8' },
    expired: { bg: '#f4f4f5', color: '#52525b' },
    revoked: { bg: '#fef2f2', color: '#b91c1c' },
  }
  const c = map[status] ?? map.expired
  return (
    <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 10, borderRadius: 6, padding: '2px 7px', background: c.bg, color: c.color }}>
      {status}
    </span>
  )
}

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const S = {
  sectionTitle:  { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 20, fontWeight: 400, color: 'var(--tx)', margin: '0 0 16px' },
  generateRow:   { display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 },
  generateCard:  { background: '#fff', border: '1px solid var(--bd)', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 220 },
  cardLabel:     { fontFamily: '"Space Mono",monospace', fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  btnPrimary:    { background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', whiteSpace: 'nowrap' },
  input:         { fontSize: 13, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 7, padding: '7px 10px', color: 'var(--tx)', background: '#fff', minWidth: 90 },
  errMsg:        { fontSize: 13, color: '#e04', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', marginBottom: 12 },
  muted:         { fontSize: 14, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  empty:         { textAlign: 'center', padding: '28px 0', border: '1px dashed var(--bd)', borderRadius: 10 },
  emptyText:     { fontSize: 14, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif', margin: 0 },
  tableWrap:     { overflowX: 'auto', borderRadius: 10, border: '1px solid var(--bd)', background: '#fff' },
  table:         { width: '100%', borderCollapse: 'collapse' },
  th:            { fontFamily: '"Space Mono",monospace', fontSize: 10, color: 'var(--tx3)', textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid var(--bd)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  tr:            { borderBottom: '1px solid var(--bd)' },
  td:            { padding: '11px 14px', verticalAlign: 'middle', fontSize: 13, color: 'var(--tx)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  mono:          { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx2)' },
  copyBtn:       { background: 'none', border: '1px solid var(--bd)', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: 'var(--pk)', fontFamily: '"DM Sans",system-ui,sans-serif', whiteSpace: 'nowrap' },
  revokeBtn:     { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--tx3)', padding: 0, fontFamily: '"DM Sans",system-ui,sans-serif' },
}
