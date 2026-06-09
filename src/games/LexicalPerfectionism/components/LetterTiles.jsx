// 10 letter tiles. Tiles whose display index appears in usedIndices fade to 18% opacity.
export default function LetterTiles({ displayLetters, usedIndices }) {
  const usedSet = new Set(usedIndices);
  return (
    <div style={S.row}>
      {displayLetters.map((letter, i) => (
        <div
          key={i}
          style={{
            ...S.tile,
            opacity: usedSet.has(i) ? 0.18 : 1,
          }}
        >
          {letter}
        </div>
      ))}
    </div>
  );
}

const S = {
  row: {
    display: 'flex',
    gap: 6,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  tile: {
    width: 44,
    height: 52,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fff',
    border: '1px solid var(--bd)',
    borderRadius: 8,
    fontFamily: '"Space Mono", monospace',
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--tx)',
    transition: 'opacity 0.1s',
    userSelect: 'none',
  },
};
