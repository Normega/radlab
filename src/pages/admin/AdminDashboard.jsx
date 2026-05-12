import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

function useSummary() {
  return useQuery({
    queryKey: ['admin-summary'],
    queryFn: async () => {
      const [sessions, protocols, activeStudies] = await Promise.all([
        supabase.from('session_templates').select('id', { count: 'exact', head: true }),
        supabase.from('study_protocols').select('id', { count: 'exact', head: true }),
        supabase
          .from('participant_schedule')
          .select('study_id', { count: 'exact', head: false })
          .not('study_id', 'is', null)
          .then(({ data }) => {
            const unique = new Set((data ?? []).map(r => r.study_id))
            return { count: unique.size }
          }),
      ])
      return {
        sessions:     sessions.count ?? 0,
        protocols:    protocols.count ?? 0,
        studies:      activeStudies.count,
      }
    },
  })
}

export default function AdminDashboard() {
  const { data } = useSummary()

  const cards = [
    {
      label: 'Session Templates',
      count: data?.sessions,
      to: '/admin/sessions',
      empty: 'No sessions yet. Build your first one.',
      hint: 'A session is an ordered sequence of activities delivered in one sitting.',
    },
    {
      label: 'Protocols',
      count: data?.protocols,
      to: '/admin/protocols',
      empty: 'No protocols yet. Assemble one from your sessions.',
      hint: 'A protocol defines the schedule and session sequence for a study.',
    },
    {
      label: 'Active Studies',
      count: data?.studies,
      to: '/admin/studies',
      empty: 'No studies yet. Launch one using a protocol.',
      hint: 'Studies enroll participants into a protocol.',
    },
  ]

  return (
    <div>
      <h1 style={S.h1}>Overview</h1>
      <p style={S.sub}>The composition chain: sessions → protocols → studies.</p>

      <div style={S.grid}>
        {cards.map(c => (
          <Link key={c.to} to={c.to} style={S.card}>
            <span style={S.countLabel}>{c.label}</span>
            {data === undefined ? (
              <span style={S.count}>—</span>
            ) : c.count === 0 ? (
              <>
                <span style={{ ...S.count, color: 'var(--gy)' }}>0</span>
                <p style={S.empty}>{c.empty}</p>
              </>
            ) : (
              <span style={S.count}>{c.count}</span>
            )}
            <span style={S.arrow}>→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

const S = {
  h1: {
    fontFamily: '"DM Serif Display",Georgia,serif',
    fontSize: 28, fontWeight: 400,
    color: 'var(--tx)', margin: '0 0 6px',
  },
  sub: { fontSize: 14, color: 'var(--tx2)', margin: '0 0 32px' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 16,
  },
  card: {
    background: '#fff',
    border: '1px solid var(--bd)',
    borderRadius: 12,
    padding: '24px 20px',
    textDecoration: 'none',
    display: 'flex', flexDirection: 'column', gap: 8,
    transition: 'box-shadow 0.15s',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    position: 'relative',
  },
  countLabel: {
    fontFamily: '"Space Mono",monospace',
    fontSize: 11, color: 'var(--tx3)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  count: {
    fontFamily: '"DM Serif Display",Georgia,serif',
    fontSize: 40, color: 'var(--pk)', lineHeight: 1,
  },
  empty: { fontSize: 13, color: 'var(--tx2)', margin: 0, lineHeight: 1.5 },
  arrow: {
    position: 'absolute', bottom: 18, right: 20,
    fontSize: 16, color: 'var(--pk)',
  },
}
