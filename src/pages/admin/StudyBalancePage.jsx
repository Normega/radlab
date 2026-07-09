// Balance audit view (Phase 2, Pass 2) — read-only. Shows marginal counts
// per randomize/counterbalance node (from the existing assignment_balance
// view) plus a stratified cross-tab for every (randomize, counterbalance)
// node pair present in the graph, computed client-side from raw
// participant_assignments rows. No new SQL view — row counts per study are
// small enough that a client-side pivot is simpler than a materialized one.
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

function useStudyGraph(id) {
  return useQuery({
    queryKey: ['study-balance-graph', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('studies')
        .select('id, name, design_graph')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })
}

function useAssignmentBalance(id) {
  return useQuery({
    queryKey: ['assignment-balance', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignment_balance')
        .select('node_id, value, n')
        .eq('study_id', id)
      if (error) throw error
      return data ?? []
    },
  })
}

function useRawAssignments(id) {
  return useQuery({
    queryKey: ['participant-assignments-raw', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('participant_assignments')
        .select('participant_id, node_id, kind, value')
        .eq('study_id', id)
      if (error) throw error
      return data ?? []
    },
  })
}

function labelForValue(node, value, nodeMap) {
  if (node.type === 'randomize') return value
  if (node.type === 'counterbalance' && Array.isArray(value)) {
    return value.map(bid => nodeMap[bid]?.label || bid).join(' → ')
  }
  return JSON.stringify(value)
}

export default function StudyBalancePage() {
  const { id } = useParams()
  const { data: study, isLoading: loadingStudy } = useStudyGraph(id)
  const { data: balanceRows = [], isLoading: loadingBalance } = useAssignmentBalance(id)
  const { data: rawRows = [], isLoading: loadingRaw } = useRawAssignments(id)

  if (loadingStudy || loadingBalance || loadingRaw) return <p style={S.muted}>Loading…</p>
  if (!study) return <p style={S.muted}>Study not found.</p>

  const graph = study.design_graph ?? { nodes: [], edges: [] }
  const nodeMap = Object.fromEntries(graph.nodes.map(n => [n.id, n]))
  const randomizeNodes = graph.nodes.filter(n => n.type === 'randomize')
  const counterbalanceNodes = graph.nodes.filter(n => n.type === 'counterbalance')

  // Marginal counts, grouped by node_id.
  const marginalByNode = {}
  for (const row of balanceRows) {
    if (!marginalByNode[row.node_id]) marginalByNode[row.node_id] = []
    marginalByNode[row.node_id].push(row)
  }

  // Per-participant assignment lookup, for the stratified cross-tab.
  const byParticipant = {}
  for (const row of rawRows) {
    if (!byParticipant[row.participant_id]) byParticipant[row.participant_id] = {}
    byParticipant[row.participant_id][row.node_id] = row.value
  }

  const crossTabs = []
  for (const rNode of randomizeNodes) {
    for (const cbNode of counterbalanceNodes) {
      const counts = {}
      for (const assignments of Object.values(byParticipant)) {
        const rVal = assignments[rNode.id]
        const cbVal = assignments[cbNode.id]
        if (rVal === undefined || cbVal === undefined) continue
        const rLabel  = labelForValue(rNode, rVal, nodeMap)
        const cbLabel = labelForValue(cbNode, cbVal, nodeMap)
        counts[rLabel] = counts[rLabel] ?? {}
        counts[rLabel][cbLabel] = (counts[rLabel][cbLabel] ?? 0) + 1
      }
      if (Object.keys(counts).length > 0) {
        crossTabs.push({ rNode, cbNode, counts })
      }
    }
  }

  return (
    <div>
      <Link to={`/admin/studies/${id}/design`} style={S.backLink}>← Design</Link>
      <h1 style={S.h1}>{study.name} — Balance audit</h1>
      <p style={S.sub}>Read-only. Draws are from participant_assignments; no editing here.</p>

      {randomizeNodes.length === 0 && counterbalanceNodes.length === 0 && (
        <p style={S.muted}>This study's graph has no randomize or counterbalance nodes yet.</p>
      )}

      {randomizeNodes.map(node => (
        <div key={node.id} style={S.card}>
          <div style={S.cardTitle}>⑂ Randomize — {node.label || node.id}</div>
          {(marginalByNode[node.id] ?? []).length === 0 ? (
            <p style={S.muted}>No draws yet.</p>
          ) : (
            <table style={S.table}>
              <thead>
                <tr><th style={S.th}>Group</th><th style={S.th}>Count</th></tr>
              </thead>
              <tbody>
                {(marginalByNode[node.id] ?? []).map((row, i) => (
                  <tr key={i} style={S.tr}>
                    <td style={S.td}>{labelForValue(node, row.value, nodeMap)}</td>
                    <td style={S.td}><span style={S.mono}>{row.n}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}

      {counterbalanceNodes.map(node => (
        <div key={node.id} style={S.card}>
          <div style={S.cardTitle}>⇄ Counterbalance — {node.label || node.id}</div>
          {(marginalByNode[node.id] ?? []).length === 0 ? (
            <p style={S.muted}>No draws yet.</p>
          ) : (
            <table style={S.table}>
              <thead>
                <tr><th style={S.th}>Order</th><th style={S.th}>Count</th></tr>
              </thead>
              <tbody>
                {(marginalByNode[node.id] ?? []).map((row, i) => (
                  <tr key={i} style={S.tr}>
                    <td style={S.td}>{labelForValue(node, row.value, nodeMap)}</td>
                    <td style={S.td}><span style={S.mono}>{row.n}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}

      {crossTabs.map(({ rNode, cbNode, counts }) => {
        const cbLabels = [...new Set(Object.values(counts).flatMap(c => Object.keys(c)))]
        const rLabels  = Object.keys(counts)
        return (
          <div key={`${rNode.id}:${cbNode.id}`} style={S.card}>
            <div style={S.cardTitle}>
              Stratified — {cbNode.label || cbNode.id} order within {rNode.label || rNode.id} group
            </div>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Group \ Order</th>
                  {cbLabels.map(l => <th key={l} style={S.th}>{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {rLabels.map(rLabel => (
                  <tr key={rLabel} style={S.tr}>
                    <td style={S.td}>{rLabel}</td>
                    {cbLabels.map(cbLabel => (
                      <td key={cbLabel} style={S.td}>
                        <span style={S.mono}>{counts[rLabel][cbLabel] ?? 0}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

const S = {
  backLink:  { fontSize: 13, color: 'var(--tx2)', textDecoration: 'none', display: 'inline-block', marginBottom: 8 },
  h1:        { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 26, fontWeight: 400, color: 'var(--tx)', margin: '0 0 6px' },
  sub:       { fontSize: 13, color: 'var(--tx2)', margin: '0 0 28px' },
  muted:     { fontSize: 14, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  card:      { background: '#fff', border: '1px solid var(--bd)', borderRadius: 10, padding: '18px 20px', marginBottom: 20, maxWidth: 620 },
  cardTitle: { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--pkd)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 },
  table:     { width: '100%', borderCollapse: 'collapse' },
  th:        { fontFamily: '"Space Mono",monospace', fontSize: 10, color: 'var(--tx3)', textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid var(--bd)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  tr:        { borderBottom: '1px solid var(--bd)' },
  td:        { padding: '8px 10px', fontSize: 13, fontFamily: '"DM Sans",system-ui,sans-serif', color: 'var(--tx)' },
  mono:      { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx2)' },
}
