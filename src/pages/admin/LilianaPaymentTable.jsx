// Payment worksheet for a paid recruitment route (studies.compensation_kind =
// 'pay', e.g. Liliana Study 3 — Paid). Same earned time as the SONA credit
// report (get_liliana_credit_report: 30/20/25 min assessments, 4 min per daily
// session, rounded up to the half hour, capped at 3 h), turned into dollars at
// the consented rate. Payment is due within ~5 business days of completion or
// withdrawal; "Mark paid" records the e-transfer in participant_compensation.
// Nothing here sends money.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export const HOURLY_RATE_CAD = 18

function usePayRows(studyId) {
  return useQuery({
    queryKey: ['liliana-pay-rows', studyId],
    queryFn: async () => {
      const [enr, comp] = await Promise.all([
        supabase.from('study_enrollments')
          .select('id, external_id, contact_email, status, withdrawn_at, consent_date')
          .eq('study_id', studyId),
        supabase.from('participant_compensation')
          .select('enrollment_id, amount_cad, paid_at')
          .eq('study_id', studyId)
          .eq('compensation_type', 'pay')
          .not('paid_at', 'is', null),
      ])
      if (enr.error) throw enr.error
      if (comp.error) throw comp.error
      return { enrollments: enr.data ?? [], payments: comp.data ?? [] }
    },
  })
}

export default function LilianaPaymentTable({ studyId, rows }) {
  const qc = useQueryClient()
  const { data, error } = usePayRows(studyId)
  const enrByExt = new Map((data?.enrollments ?? []).map((e) => [e.external_id, e]))
  const paidByEnr = new Map()
  for (const p of data?.payments ?? []) {
    paidByEnr.set(p.enrollment_id, (paidByEnr.get(p.enrollment_id) ?? 0) + Number(p.amount_cad ?? 0))
  }

  const markPaid = useMutation({
    mutationFn: async ({ enrollment, amount }) => {
      const { error } = await supabase.from('participant_compensation').insert({
        enrollment_id:     enrollment.id,
        participant_id:    enrollment.external_id,
        study_id:          studyId,
        compensation_type: 'pay',
        email:             enrollment.contact_email,
        amount_cad:        amount,
        paid_at:           new Date().toISOString(),
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['liliana-pay-rows', studyId] }),
  })

  const lines = rows
    .map((r) => {
      const e = enrByExt.get(r.sona_identifier)
      if (!e || !e.consent_date) return null
      const owed = Number(r.credit_hours) * HOURLY_RATE_CAD
      const paid = paidByEnr.get(e.id) ?? 0
      const due = e.status === 'completed' || e.status === 'withdrawn'
      return { r, e, owed, paid, due }
    })
    .filter(Boolean)

  return (
    <>
      {error && <p style={S.err}>Could not load payment records: {error.message}</p>}
      {markPaid.error && <p style={S.err}>Could not record payment: {markPaid.error.message}</p>}
      <div style={S.wrap}>
        <table style={S.table}>
          <thead>
            <tr>
              {['ID', 'U of T email', 'Status', 'Hours', 'Earned', 'Paid', ''].map((h) => <th key={h} style={S.th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {lines.map(({ r, e, owed, paid, due }) => {
              const outstanding = Math.max(0, owed - paid)
              return (
                <tr key={e.id} style={S.tr}>
                  <td style={S.td}><span style={S.mono}>{e.external_id}</span></td>
                  <td style={S.td}>{e.contact_email ?? '—'}</td>
                  <td style={S.td}>{due ? <strong>{e.status} — payment due</strong> : e.status}</td>
                  <td style={S.td}><span style={S.mono}>{r.credit_hours}</span></td>
                  <td style={S.td}><span style={S.mono}>${owed.toFixed(2)}</span></td>
                  <td style={S.td}><span style={S.mono}>${paid.toFixed(2)}</span></td>
                  <td style={S.td}>
                    {due && outstanding > 0 && (
                      <button
                        style={S.btn}
                        disabled={markPaid.isPending}
                        onClick={() => {
                          if (window.confirm(`Record an e-transfer of $${outstanding.toFixed(2)} to ${e.contact_email}?`)) {
                            markPaid.mutate({ enrollment: e, amount: outstanding })
                          }
                        }}
                      >
                        Mark ${outstanding.toFixed(2)} paid
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

const S = {
  wrap:  { overflowX: 'auto', borderRadius: 10, border: '1px solid var(--bd)', background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th:    { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid var(--bd)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' },
  tr:    { borderBottom: '1px solid var(--bd)' },
  td:    { padding: '11px 16px', verticalAlign: 'middle', fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif', color: 'var(--tx)' },
  mono:  { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx2)' },
  btn:   { padding: '6px 12px', borderRadius: 7, border: '1px solid var(--pk)', background: '#fff', color: 'var(--pk)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: '"DM Sans",system-ui,sans-serif' },
  err:   { fontSize: 14, color: '#e04', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', marginBottom: 16 },
}
