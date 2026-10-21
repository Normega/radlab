import { DEFAULT_SUPPORT_RESOURCES } from '../../lib/supportResources'

// The support list shown wherever someone learns they can't take part:
// the screener's result card's twin on the return-visit screens
// (SessionEntry's screened-out state, /join's screened-out state).
export default function SupportResources({ resources }) {
  const list = resources?.length ? resources : DEFAULT_SUPPORT_RESOURCES
  return (
    <div style={S.wrap}>
      <div style={S.heading}>Support resources</div>
      <p style={S.lead}>If you’d like to talk to someone, these services are free and confidential.</p>
      {list.map((r, i) => (
        <div key={i} style={S.item}>
          <span style={S.name}>{r.name}</span>
          <span style={S.contact}>{r.contact}</span>
        </div>
      ))}
    </div>
  )
}

const FONT = '"DM Sans",system-ui,sans-serif'
const S = {
  wrap:    { marginTop: 24, textAlign: 'left', maxWidth: 480, width: '100%' },
  heading: { fontFamily: FONT, fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 4 },
  lead:    { fontFamily: FONT, fontSize: 14, color: 'var(--tx2)', margin: '0 0 8px', lineHeight: 1.5 },
  item:    { display: 'flex', justifyContent: 'space-between', gap: 16, padding: '8px 0', borderBottom: '1px solid var(--bd)', fontFamily: FONT, fontSize: 14 },
  name:    { color: 'var(--tx)' },
  contact: { color: 'var(--tx2)', textAlign: 'right' },
}
