// One row per completed set shown below the active play area.
export default function SetResults({ results }) {
  if (!results.length) return null;
  return (
    <div style={S.wrap}>
      {results.map((r, i) => (
        <div key={i} style={S.row}>
          <span style={S.setLabel}>Set {i + 1}</span>
          <span style={S.letters}>{r.letters.join(' ')}</span>
          <span style={S.word}>
            {r.word
              ? <strong style={{ color: 'var(--pk)' }}>{r.word}</strong>
              : <span style={{ color: 'var(--tx3)' }}>—</span>}
          </span>
          <span style={S.pts}>
            {r.score != null ? `+${r.score}` : '0'}
          </span>
        </div>
      ))}
    </div>
  );
}

const S = {
  wrap:     { display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 560 },
  row:      { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 14px' },
  setLabel: { fontFamily: '"Space Mono", monospace', fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0, width: 36 },
  letters:  { fontFamily: '"Space Mono", monospace', fontSize: 11, color: 'var(--tx3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  word:     { fontFamily: '"Space Mono", monospace', fontSize: 14, minWidth: 80, textAlign: 'right' },
  pts:      { fontFamily: '"Space Mono", monospace', fontSize: 13, color: 'var(--pk)', minWidth: 28, textAlign: 'right', fontWeight: 700 },
};
