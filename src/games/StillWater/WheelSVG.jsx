import { EMOTIONS, CX, CY, INNER_R, OUTER_R, LABEL_R, d2r, wedgePath, centerAngle } from './constants'

// feedbackData (for FaceRead): { correctSectorId, correctZone, clickedSectorId, clickedZone } | null
export default function WheelSVG({
  activeIds   = null,
  selection   = null,
  hovered,
  onHover,
  onZoneClick,
  onNeutral,
  revealData  = null,
  feedbackData = null,
}) {
  const ZW = (OUTER_R - INNER_R) / 3

  return (
    <svg viewBox="-12 -5 394 380" width="308" height="308"
      onMouseLeave={() => onHover(null)} style={{ display: 'block', flexShrink: 0 }}>
      <defs>
        {EMOTIONS.map(e => (
          <radialGradient key={e.id} id={`wg${e.id}`} cx={CX} cy={CY} r={OUTER_R} gradientUnits="userSpaceOnUse">
            <stop offset="0%"                                              stopColor="#FCF0F5" />
            <stop offset={`${(INNER_R / OUTER_R * 100).toFixed(1)}%`}    stopColor={e.inner} stopOpacity="0.75" />
            <stop offset="100%"                                            stopColor={e.outer} />
          </radialGradient>
        ))}
        <filter id="wGl" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="wGlGreen" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {EMOTIONS.map(e => {
        const isAct  = activeIds === null || activeIds.includes(e.id)
        const isSel  = selection?.emotionId === e.id
        return [0, 1, 2].map(z => {
          const r1 = INNER_R + z * ZW, r2 = INNER_R + (z + 1) * ZW
          const isRev     = revealData    && revealData.sectorId    === e.id && revealData.zone    === z
          const isSelZ    = isSel         && selection?.zone        === z
          const isCorrect = feedbackData  && feedbackData.correctSectorId === e.id && feedbackData.correctZone === z
          const isClicked = feedbackData  && feedbackData.clickedSectorId === e.id && feedbackData.clickedZone === z

          let op, fill, filterAttr
          if (feedbackData) {
            if (isCorrect) { op = 1.0; filterAttr = 'url(#wGl)' }
            else if (isClicked) { op = 0.9; filterAttr = 'url(#wGl)' }
            else { op = 0.12; filterAttr = 'none' }
            fill = isCorrect ? '#1EA878' : isClicked ? '#f068a4' : `url(#wg${e.id})`
          } else if (revealData) {
            op = isRev ? 1.0 : 0.22
            fill = `url(#wg${e.id})`
            filterAttr = isRev ? 'url(#wGl)' : 'none'
          } else if (activeIds === null) {
            op = 0.82; fill = `url(#wg${e.id})`; filterAttr = 'none'
          } else {
            op = isAct ? (isSelZ ? 1.0 : isSel ? 0.45 : hovered === e.id ? 1.0 : 0.82) : 0.08
            fill = `url(#wg${e.id})`
            filterAttr = isSelZ ? 'url(#wGl)' : 'none'
          }

          const click = isAct && activeIds !== null && !feedbackData
          return (
            <path key={`${e.id}-${z}`}
              d={wedgePath(e.startAngle, e.endAngle, r1, r2)}
              fill={fill} stroke="#FCF0F5" strokeWidth="1.2"
              opacity={op} filter={filterAttr}
              style={{ cursor: click ? 'pointer' : 'default', transition: 'opacity 0.14s ease' }}
              onClick={click ? () => onZoneClick({ emotion: e, zone: z }) : undefined}
              onMouseEnter={isAct && !feedbackData ? () => onHover(e.id) : undefined}
            />
          )
        })
      })}

      {/* Zone ring dividers */}
      {[1 / 3, 2 / 3].map((t, i) => (
        <circle key={i} cx={CX} cy={CY} r={INNER_R + (OUTER_R - INNER_R) * t}
          fill="none" stroke="white" strokeWidth="1.1" opacity="0.55" strokeDasharray="3 6"
          style={{ pointerEvents: 'none' }} />
      ))}

      {/* Emotion labels */}
      {EMOTIONS.map(e => {
        const ca  = centerAngle(e)
        const lx  = CX + LABEL_R * Math.cos(d2r(ca))
        const ly  = CY + LABEL_R * Math.sin(d2r(ca))
        const isAct  = activeIds === null || activeIds.includes(e.id)
        const isSel  = selection?.emotionId === e.id
        const isRev  = revealData?.sectorId === e.id
        const isCorr = feedbackData?.correctSectorId === e.id
        const isClkd = feedbackData?.clickedSectorId === e.id
        const fc = feedbackData
          ? (isCorr ? '#1EA878' : isClkd ? '#f068a4' : '#bbb')
          : isRev ? '#1c1c1e' : isSel ? '#1c1c1e' : isAct && activeIds !== null ? (hovered === e.id ? '#444' : '#666') : '#bbb'
        return (
          <text key={e.id} x={lx} y={ly + 4} textAnchor="middle"
            fill={fc}
            fontSize={isSel || isRev || isCorr || isClkd ? '14' : '13'}
            fontWeight={isSel || isRev || isCorr || isClkd ? '600' : '400'}
            fontFamily="DM Sans,sans-serif"
            style={{ pointerEvents: 'none', transition: 'fill 0.15s' }}>
            {e.name}
          </text>
        )
      })}

      {/* Neutral centre */}
      <circle cx={CX} cy={CY} r={INNER_R}
        fill={selection?.neutral ? '#f0d8e8' : '#FCF0F5'}
        stroke={selection?.neutral ? '#f068a4' : '#E8D4E0'}
        strokeWidth={selection?.neutral ? 2 : 1}
        style={{ cursor: activeIds !== null && !feedbackData ? 'pointer' : 'default' }}
        onClick={activeIds !== null && !feedbackData ? onNeutral : undefined}
        onMouseEnter={() => onHover(null)} />
      <text x={CX} y={CY + 4} textAnchor="middle"
        fill={selection?.neutral ? '#f068a4' : '#C4ACBC'}
        fontSize="13" fontFamily="DM Sans,sans-serif"
        style={{ pointerEvents: 'none' }}>
        neutral
      </text>
    </svg>
  )
}
