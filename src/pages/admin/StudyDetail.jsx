import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { generateSchedule, issueLink } from '../../lib/scheduleGenerator'

// ─── Data hooks ──────────────────────────────────────────────────────────────

function useStudy(id) {
  return useQuery({
    queryKey: ['study-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('studies')
        .select(`
          id, name, created_at, messaging_required,
          study_protocol_assignments(
            study_protocols(id, label, protocol_type)
          )
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      const protocol = data.study_protocol_assignments?.[0]?.study_protocols
      return { ...data, protocol }
    },
  })
}

function useParticipants(studyId) {
  return useQuery({
    queryKey: ['study-participants', studyId],
    queryFn: async () => {
      const { data: consents, error } = await supabase
        .from('participant_consent')
        .select('id, participant_id, consented_at, withdrawn_at, profiles(id, display_name)')
        .eq('study_id', studyId)
        .is('withdrawn_at', null)
        .order('consented_at')
      if (error) throw error

      const participantIds = consents.map(c => c.participant_id)
      if (!participantIds.length) return []

      const { data: schedule } = await supabase
        .from('participant_schedule')
        .select('id, participant_id, status, completed_at')
        .eq('study_id', studyId)
        .in('participant_id', participantIds)

      const schedMap = {}
      for (const row of (schedule ?? [])) {
        if (!schedMap[row.participant_id]) schedMap[row.participant_id] = []
        schedMap[row.participant_id].push(row)
      }

      return consents.map(c => {
        const rows = schedMap[c.participant_id] ?? []
        const total = rows.length
        const completed = rows.filter(r => r.status === 'completed').length
        const lastActive = rows
          .map(r => r.completed_at)
          .filter(Boolean)
          .sort()
          .at(-1)
        return {
          consentId: c.id,
          participantId: c.participant_id,
          displayName: c.profiles?.display_name || '—',
          enrolledAt: c.consented_at,
          total,
          completed,
          lastActive,
        }
      })
    },
    enabled: !!studyId,
  })
}

function useParticipantSchedule(studyId, participantId) {
  return useQuery({
    queryKey: ['participant-schedule', studyId, participantId],
    enabled: !!studyId && !!participantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('participant_schedule')
        .select(`
          id, study_day, period_of_day, scheduled_for, status,
          completed_at, attempts, link_id,
          participant_links:link_id(id, token, status, expires_at)
        `)
        .eq('study_id', studyId)
        .eq('participant_id', participantId)
        .order('scheduled_for', { ascending: true, nullsFirst: true })
      if (error) throw error
      return data
    },
  })
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StudyDetail() {
  const { id } = useParams()
  const qc = useQueryClient()
  const { data: study, isLoading: studyLoading } = useStudy(id)
  const { data: participants = [], isLoading: participantsLoading } = useParticipants(id)

  const [selectedParticipant, setSelectedParticipant] = useState(null)
  const [addEmail, setAddEmail] = useState('')
  const [addError, setAddError] = useState(null)
  const [addSuccess, setAddSuccess] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const addParticipant = useMutation({
    mutationFn: async (email) => {
      const { data: userId, error: pe } = await supabase
        .rpc('get_user_id_by_email', { lookup_email: email.trim().toLowerCase() })
      if (pe) throw pe
      if (!userId) throw new Error(`No account found for ${email}. They need to sign up first.`)

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('id', userId)
        .single()

      const existing = await supabase
        .from('participant_consent')
        .select('id')
        .eq('participant_id', profile.id)
        .eq('study_id', id)
        .is('withdrawn_at', null)
        .maybeSingle()
      if (existing.data) throw new Error('This participant is already enrolled in this study.')

      const messagingBasis = study?.messaging_required ? 'research_exemption' : 'explicit_consent'
      const { error: ce } = await supabase.from('participant_consent').insert({
        participant_id: profile.id,
        study_id: id,
        messaging_basis: messagingBasis,
      })
      if (ce) throw ce

      const protocol = study?.protocol
      if (!protocol) throw new Error('No protocol assigned to this study.')

      const scheduleRows = await generateSchedule(profile.id, protocol.id, new Date())

      if (scheduleRows?.length) {
        const rowIds = scheduleRows.map(r => r.id)
        await supabase.from('participant_schedule').update({ study_id: id }).in('id', rowIds)
      }

      if (protocol.protocol_type === 'single_shot' && scheduleRows?.length) {
        await issueLink(scheduleRows[0].id)
      }

      return profile?.display_name || email
    },
    onSuccess: (name) => {
      qc.invalidateQueries({ queryKey: ['study-participants', id] })
      qc.invalidateQueries({ queryKey: ['study-detail', id] })
      setAddEmail('')
      setAddSuccess(`${name} enrolled successfully.`)
      setAddError(null)
      setShowAddForm(false)
    },
    onError: (e) => { setAddError(e.message); setAddSuccess(null) },
  })

  if (studyLoading) return <p style={S.muted}>Loading…</p>

  const protocol = study?.protocol

  return (
    <div>
      <div style={S.header}>
        <div>
          <Link to="/admin/studies" style={S.backLink}>← Studies</Link>
          <h1 style={S.h1}>{study?.name}</h1>
          <p style={S.sub}>
            {protocol?.label ?? '—'}
            {protocol?.protocol_type && (
              <span style={S.typePill}>{protocol.protocol_type === 'single_shot' ? 'one-time' : 'scheduled'}</span>
            )}
            <span style={S.sep}>·</span>
            {fmtDate(study?.created_at)}
            <span style={S.sep}>·</span>
            {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
          </p>
        </div>
      </div>

      {selectedParticipant ? (
        <ScheduleView
          studyId={id}
          participant={selectedParticipant}
          onBack={() => setSelectedParticipant(null)}
          qc={qc}
        />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={S.sectionTitle}>Participants</h2>
            <button style={S.btnPrimary} onClick={() => { setShowAddForm(v => !v); setAddError(null); setAddSuccess(null) }}>
              {showAddForm ? 'Cancel' : '+ Add participant'}
            </button>
          </div>

          {showAddForm && (
            <div style={S.addForm}>
              <input
                style={{ ...S.input, flex: 1 }}
                placeholder="participant@email.com"
                value={addEmail}
                onChange={e => setAddEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addParticipant.mutate(addEmail)}
              />
              <button
                style={{ ...S.btnPrimary, opacity: addParticipant.isPending ? 0.7 : 1 }}
                onClick={() => { setAddError(null); addParticipant.mutate(addEmail) }}
                disabled={addParticipant.isPending}
              >
                {addParticipant.isPending ? 'Enrolling…' : 'Enroll'}
              </button>
            </div>
          )}

          {addError && <p style={S.errMsg}>{addError}</p>}
          {addSuccess && <p style={S.successMsg}>{addSuccess}</p>}

          {participantsLoading ? (
            <p style={S.muted}>Loading participants…</p>
          ) : participants.length === 0 ? (
            <div style={S.empty}>
              <p style={S.emptyText}>No participants yet.</p>
              <p style={S.emptyHint}>Add someone by their email address to enroll them.</p>
            </div>
          ) : (
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {['Name', 'Enrolled', 'Progress', 'Last active', 'Actions'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {participants.map(p => (
                    <tr key={p.participantId} style={S.tr}>
                      <td style={S.td}>
                        <span style={S.pName}>{p.displayName}</span>
                      </td>
                      <td style={S.td}><span style={S.mono}>{fmtDate(p.enrolledAt)}</span></td>
                      <td style={S.td}>
                        {p.total > 0
                          ? <Chip>{p.completed} / {p.total} completed</Chip>
                          : <span style={S.muted}>—</span>}
                      </td>
                      <td style={S.td}>
                        {p.lastActive
                          ? <span style={S.mono}>{fmtDate(p.lastActive)}</span>
                          : <span style={S.muted}>—</span>}
                      </td>
                      <td style={S.td}>
                        <div style={S.actions}>
                          <button style={S.actionBtn} onClick={() => setSelectedParticipant(p)}>
                            View schedule
                          </button>
                          <RevokeButton participantId={p.participantId} studyId={id} qc={qc} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Schedule view ────────────────────────────────────────────────────────────

function ScheduleView({ studyId, participant, onBack, qc }) {
  const { data: rows = [], isLoading } = useParticipantSchedule(studyId, participant.participantId)
  const [copied, setCopied] = useState(null)
  const [actionError, setActionError] = useState(null)

  const issueLinkMutation = useMutation({
    mutationFn: async (scheduleId) => {
      return issueLink(scheduleId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['participant-schedule', studyId, participant.participantId] })
      qc.invalidateQueries({ queryKey: ['study-participants', studyId] })
    },
    onError: (e) => setActionError(e.message),
  })

  const revokeLink = useMutation({
    mutationFn: async ({ linkId, scheduleId }) => {
      await supabase.from('participant_links').update({ status: 'revoked' }).eq('id', linkId)
      await supabase.from('participant_schedule').update({ status: 'pending', link_id: null }).eq('id', scheduleId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['participant-schedule', studyId, participant.participantId] })
    },
    onError: (e) => setActionError(e.message),
  })

  async function copyLink(token) {
    const url = `${window.location.origin}/s/${token}`
    await navigator.clipboard.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div>
      <button style={S.backLinkBtn} onClick={onBack}>← Back to participants</button>
      <h2 style={S.sectionTitle} >{participant.displayName}'s Schedule</h2>
      <p style={{ fontSize: 13, color: 'var(--tx2)', margin: '0 0 16px' }}>{participant.email}</p>

      {actionError && <p style={S.errMsg}>{actionError}</p>}

      {isLoading ? (
        <p style={S.muted}>Loading schedule…</p>
      ) : rows.length === 0 ? (
        <p style={S.muted}>No schedule rows yet.</p>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Check-in', 'Scheduled for', 'Status', 'Completed at', 'Attempts', 'Actions'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const link = row.participant_links
                const canIssue = row.status === 'pending' && !link
                const canRevoke = link?.status === 'active'
                const rowBg = row.status === 'completed' ? '#f0fdf4'
                  : row.status === 'expired' ? '#fef2f2'
                  : 'transparent'

                return (
                  <tr key={row.id} style={{ ...S.tr, background: rowBg }}>
                    <td style={S.td}>
                      <span style={S.mono}>
                        {row.study_day != null ? `Day ${row.study_day}` : '—'}
                        {row.period_of_day ? ` · ${row.period_of_day}` : ''}
                      </span>
                    </td>
                    <td style={S.td}>
                      <span style={S.mono}>{row.scheduled_for ? fmtDateTime(row.scheduled_for) : '—'}</span>
                    </td>
                    <td style={S.td}><StatusBadge status={row.status} /></td>
                    <td style={S.td}>
                      <span style={S.mono}>{row.completed_at ? fmtDateTime(row.completed_at) : '—'}</span>
                    </td>
                    <td style={S.td}>
                      <span style={S.mono}>{row.attempts ?? 0}</span>
                    </td>
                    <td style={S.td}>
                      <div style={S.actions}>
                        {canIssue && (
                          <button
                            style={S.actionBtn}
                            onClick={() => issueLinkMutation.mutate(row.id)}
                            disabled={issueLinkMutation.isPending}
                          >
                            Issue link
                          </button>
                        )}
                        {canRevoke && (
                          <button
                            style={{ ...S.actionBtn, color: '#e04' }}
                            onClick={() => revokeLink.mutate({ linkId: link.id, scheduleId: row.id })}
                            disabled={revokeLink.isPending}
                          >
                            Revoke
                          </button>
                        )}
                        {link?.token && link.status === 'active' && (
                          <button
                            style={S.actionBtn}
                            onClick={() => copyLink(link.token)}
                          >
                            {copied === link.token ? 'Copied!' : 'Copy link'}
                          </button>
                        )}
                      </div>
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

// ─── Revoke access button ─────────────────────────────────────────────────────

function RevokeButton({ participantId, studyId, qc }) {
  const [confirming, setConfirming] = useState(false)

  const revoke = useMutation({
    mutationFn: async () => {
      await supabase
        .from('participant_consent')
        .update({ withdrawn_at: new Date().toISOString() })
        .eq('participant_id', participantId)
        .eq('study_id', studyId)
        .is('withdrawn_at', null)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['study-participants', studyId] })
      setConfirming(false)
    },
  })

  if (!confirming) {
    return (
      <button style={{ ...S.actionBtn, color: '#e04' }} onClick={() => setConfirming(true)}>
        Revoke access
      </button>
    )
  }

  return (
    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: 'var(--tx2)' }}>Sure?</span>
      <button style={{ ...S.actionBtn, color: '#e04' }} onClick={() => revoke.mutate()} disabled={revoke.isPending}>
        Yes
      </button>
      <button style={S.actionBtn} onClick={() => setConfirming(false)}>No</button>
    </span>
  )
}

// ─── Small components ─────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const colors = {
    completed:  { bg: '#f0fdf4', color: '#15803d' },
    expired:    { bg: '#fef2f2', color: '#b91c1c' },
    link_sent:  { bg: '#eff6ff', color: '#1d4ed8' },
    pending:    { bg: '#f4f4f5', color: '#52525b' },
    unlocked:   { bg: '#fef9c3', color: '#92400e' },
    blocked:    { bg: '#fef2f2', color: '#b91c1c' },
  }
  const c = colors[status] ?? colors.pending
  return (
    <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 10, borderRadius: 6, padding: '2px 7px', background: c.bg, color: c.color }}>
      {status}
    </span>
  )
}

function Chip({ children }) {
  return <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 11, background: 'var(--pkb)', color: 'var(--pk)', borderRadius: 6, padding: '2px 7px' }}>{children}</span>
}

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const S = {
  header: { marginBottom: 28 },
  backLink: { fontSize: 13, color: 'var(--tx2)', textDecoration: 'none', display: 'inline-block', marginBottom: 8 },
  backLinkBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--tx2)', padding: 0, marginBottom: 12, fontFamily: '"DM Sans",system-ui,sans-serif' },
  h1: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 26, fontWeight: 400, color: 'var(--tx)', margin: '0 0 6px' },
  sub: { fontSize: 13, color: 'var(--tx2)', margin: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  sep: { color: 'var(--tx3)' },
  typePill: { fontFamily: '"Space Mono",monospace', fontSize: 10, background: 'var(--pkb)', color: 'var(--pk)', borderRadius: 6, padding: '2px 7px' },
  sectionTitle: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 20, fontWeight: 400, color: 'var(--tx)', margin: 0 },
  muted: { fontSize: 14, color: 'var(--tx3)' },
  mono: { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', display: 'block' },
  empty: { textAlign: 'center', padding: '40px 0' },
  emptyText: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 18, color: 'var(--tx)', margin: '0 0 6px' },
  emptyHint: { fontSize: 13, color: 'var(--tx2)', margin: 0 },
  addForm: { display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' },
  input: { fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx)', background: '#fff', minWidth: 240 },
  errMsg: { fontSize: 13, color: '#e04', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', marginBottom: 12 },
  successMsg: { fontSize: 13, color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 14px', marginBottom: 12 },
  tableWrap: { overflowX: 'auto', borderRadius: 10, border: '1px solid var(--bd)', background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid var(--bd)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  tr: { borderBottom: '1px solid var(--bd)' },
  td: { padding: '12px 16px', verticalAlign: 'middle' },
  pName: { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 14, fontWeight: 500, color: 'var(--tx)', display: 'block' },
  pEmail: { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', display: 'block' },
  actions: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--tx2)', padding: 0, fontFamily: '"DM Sans",system-ui,sans-serif' },
  btnPrimary: { display: 'inline-block', background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', whiteSpace: 'nowrap' },
}
