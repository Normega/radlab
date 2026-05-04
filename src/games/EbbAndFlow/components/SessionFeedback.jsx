import { useMemo } from 'react';
import {
  LineChart, Line, ResponsiveContainer, Tooltip, ReferenceLine,
} from 'recharts';

// ── Constants ──────────────────────────────────────────────────────────────

const PRIOR_SD = 0.15;
const MONO     = '"Space Mono", "Courier New", monospace';
const SANS     = '"DM Sans", system-ui, sans-serif';
const SERIF    = '"DM Serif Display", Georgia, serif';

const AMBER = '#BA7517';
const BLUE  = '#185FA5';
const PINK  = '#f068a4';

// ── Helpers ────────────────────────────────────────────────────────────────

function sdToPct(sd) {
  return Math.max(0, Math.min(100, Math.round((1 - sd / PRIOR_SD) * 100)));
}

// Linear regression over an array of numbers; returns { slope, intercept }
function linearRegression(values) {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  const slope     = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  return { slope, intercept };
}

function syncTrend(scores) {
  const { slope } = linearRegression(scores ?? []);
  if (slope > 0.03)  return 'strengthening';
  if (slope < -0.03) return 'fading';
  return 'steady';
}

// Arc path: M 10 64 A 45 45 0 0 1 100 64  (half-circle opening upward)
const ARC_LEN = 141.4;
const ARC_PATH = 'M 10 64 A 45 45 0 0 1 100 64';

// ── Sub-components ─────────────────────────────────────────────────────────

function ArcCard({ label, sd, color }) {
  const pct    = sdToPct(sd);
  const filled = (pct / 100) * ARC_LEN;
  const offset = ARC_LEN - filled;

  const status =
    pct >= 70 ? 'well mapped' :
    pct >= 35 ? 'signal emerging' :
    'still calibrating';

  return (
    <div style={S.arcCard}>
      <svg viewBox="-5 10 120 65" style={{ width: '100%', maxWidth: 140, display: 'block', margin: '0 auto' }}>
        {/* Track */}
        <path
          d={ARC_PATH}
          fill="none"
          stroke="var(--bd)"
          strokeWidth={8}
          strokeLinecap="round"
        />
        {/* Fill */}
        <path
          d={ARC_PATH}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={ARC_LEN}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.7s ease' }}
        />
        {/* Percentage label */}
        <text
          x="55"
          y="58"
          textAnchor="middle"
          fontFamily={MONO}
          fontSize="17"
          fontWeight="700"
          fill={color}
        >
          {pct}%
        </text>
      </svg>
      <p style={{ ...S.arcLabel, color }}>{label}</p>
      <p style={S.arcStatus}>{status}</p>
    </div>
  );
}

function TrendPill({ trend }) {
  const cfg = {
    strengthening: { bg: 'rgba(24,95,165,0.12)', color: BLUE,  text: 'strengthening ↑' },
    fading:        { bg: 'rgba(240,104,164,0.12)', color: PINK, text: 'fading ↓' },
    steady:        { bg: 'var(--bgp)',             color: 'var(--tx2)', text: 'steady →' },
  }[trend];
  return (
    <span style={{ ...S.pill, background: cfg.bg, color: cfg.color }}>
      {cfg.text}
    </span>
  );
}

function AwarenessPill({ pct }) {
  const cfg =
    pct >= 70
      ? { bg: 'rgba(24,95,165,0.12)', color: BLUE,  text: 'well calibrated' }
      : pct >= 45
      ? { bg: 'var(--bgp)',            color: 'var(--tx2)', text: 'developing' }
      : { bg: 'rgba(240,104,164,0.12)', color: PINK, text: 'still learning' };
  return (
    <span style={{ ...S.pill, background: cfg.bg, color: cfg.color }}>
      {cfg.text}
    </span>
  );
}

// Recharts custom tooltip
function SyncTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value;
  return (
    <div style={{ background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 8, padding: '5px 10px' }}>
      <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--tx)' }}>
        {typeof v === 'number' ? (v * 100).toFixed(0) + '%' : ''}
      </span>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function SessionFeedback({
  excitementSD   = PRIOR_SD,
  calmSD         = PRIOR_SD,
  syncScores     = [],
  changeAwareness = 0,
  sessionTrialCount = 0,
  totalTrialCount   = 0,
  sessionScore      = 0,
  onContinue,
  onBreak,
}) {
  // Chart uses only the most recent 10 trials
  const recentSync = useMemo(() => syncScores.slice(-10), [syncScores]);

  const trend    = useMemo(() => syncTrend(recentSync), [recentSync]);
  const syncMean = recentSync.length
    ? recentSync.reduce((a, b) => a + b, 0) / recentSync.length
    : 0;

  // Chart data: trial-by-trial + trend line overlay (last 10 only)
  const { slope, intercept } = useMemo(() => linearRegression(recentSync), [recentSync]);
  const chartData = useMemo(() =>
    recentSync.map((v, i) => ({
      i,
      sync:  v,
      trend: intercept + slope * i,
    })),
    [recentSync, slope, intercept]
  );

  const awarenessPct = Math.round(changeAwareness * 100);
  const awarenessText =
    awarenessPct >= 70 ? 'When you felt sure, you were right.' :
    awarenessPct >= 45 ? 'Your confidence and accuracy are starting to align.' :
    'Still learning when to trust your detections.';

  const showFocus = Math.abs(excitementSD - calmSD) > 0.04;
  const focusDir  = calmSD > excitementSD ? 'calm' : 'excitement';
  const focusText = focusDir === 'calm'
    ? 'Your calm signal still has room to sharpen. Try noticing the exact moment your breath slows in daily life — the pause before it turns.'
    : 'Your excitement signal still has room to sharpen. Try noticing the moment something catches your attention — that first quickening of breath.';

  const lessertain = excitementSD >= calmSD ? 'excitement' : 'calm';

  return (
    <div style={S.wrap}>

      {/* ── Arc cards ──────────────────────────────────────────────── */}
      <div style={S.arcRow}>
        <ArcCard label="excitement" sd={excitementSD} color={AMBER} />
        <ArcCard label="calm"       sd={calmSD}       color={BLUE}  />
      </div>

      {/* ── Sync card ──────────────────────────────────────────────── */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <div>
            <p style={S.eyebrow}>connection to your avatar</p>
            <p style={S.bigNum}>
              {(syncMean * 100).toFixed(0)}
              <span style={S.bigNumUnit}>%</span>
            </p>
          </div>
          <TrendPill trend={trend} />
        </div>

        {chartData.length >= 2 && (
          <div style={{ marginTop: 12 }}>
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                <Tooltip content={<SyncTooltip />} />
                <ReferenceLine y={syncMean} stroke="var(--bd)" strokeDasharray="3 3" />
                {/* Trial-by-trial — faded */}
                <Line
                  type="monotone"
                  dataKey="sync"
                  stroke={PINK}
                  strokeWidth={1.5}
                  dot={false}
                  strokeOpacity={0.35}
                  isAnimationActive={false}
                />
                {/* Trend line — solid */}
                <Line
                  type="monotone"
                  dataKey="trend"
                  stroke={PINK}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <div style={S.chartLegend}>
              <span style={{ ...S.legendDot, opacity: 0.35, background: PINK }} /> trial-by-trial
              <span style={{ ...S.legendDot, marginLeft: 12, background: PINK }} /> trend
            </div>
          </div>
        )}
      </div>

      {/* ── Change awareness card ───────────────────────────────────── */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <p style={S.eyebrow}>change awareness</p>
          <AwarenessPill pct={awarenessPct} />
        </div>
        <p style={S.bigNum}>
          {awarenessPct}
          <span style={S.bigNumUnit}>%</span>
        </p>
        <p style={S.bodyText}>{awarenessText}</p>
      </div>

      {/* ── Focus card (conditional) ─────────────────────────────────── */}
      {showFocus && (
        <div style={{ ...S.card, borderLeft: `3px solid ${PINK}`, paddingLeft: 20 }}>
          <p style={S.eyebrow}>what to notice today</p>
          <p style={S.bodyText}>{focusText}</p>
        </div>
      )}

      {/* ── Next session card ─────────────────────────────────────────── */}
      <div style={{ ...S.card, borderLeft: '3px solid var(--bd)', paddingLeft: 20 }}>
        <p style={S.eyebrow}>next session</p>
        <p style={S.bodyText}>
          Your <strong>{lessertain}</strong> signal is the most uncertain right now — the next session will focus there.
        </p>
      </div>

      {/* ── Stats row ────────────────────────────────────────────────── */}
      <div style={S.statsRow}>
        <StatChip label="this session" value={sessionTrialCount + ' trials'} />
        <StatChip label="total"        value={totalTrialCount + ' trials'}   />
        <StatChip label="score"        value={'+' + sessionScore}            />
      </div>

      {/* ── Buttons ───────────────────────────────────────────────────── */}
      <div style={S.btnRow}>
        <button style={S.btnSecondary} onClick={onBreak}>Take a break</button>
        <button style={S.btnPrimary}   onClick={onContinue}>Practice more →</button>
      </div>

    </div>
  );
}

// ── Tiny sub-components ────────────────────────────────────────────────────

function StatChip({ label, value }) {
  return (
    <div style={S.statChip}>
      <p style={S.statLabel}>{label}</p>
      <p style={S.statValue}>{value}</p>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const S = {
  wrap: {
    maxWidth: 480,
    margin: '0 auto',
    padding: '32px 20px 48px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },

  // Arc row
  arcRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  arcCard: {
    background: 'var(--bgc)',
    border: '1px solid var(--bd)',
    borderRadius: 16,
    padding: '20px 16px 16px',
    textAlign: 'center',
  },
  arcLabel: {
    fontFamily: MONO,
    fontSize: 12,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    marginTop: 6,
    marginBottom: 4,
  },
  arcStatus: {
    fontFamily: SANS,
    fontSize: 12,
    color: 'var(--tx3)',
  },

  // Generic card
  card: {
    background: 'var(--bgc)',
    border: '1px solid var(--bd)',
    borderRadius: 16,
    padding: '18px 20px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },

  // Typography
  eyebrow: {
    fontFamily: MONO,
    fontSize: 12,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--tx3)',
    marginBottom: 4,
  },
  bigNum: {
    fontFamily: SERIF,
    fontSize: 36,
    color: 'var(--tx)',
    lineHeight: 1,
    marginBottom: 8,
  },
  bigNumUnit: {
    fontFamily: SANS,
    fontSize: 16,
    color: 'var(--tx3)',
    marginLeft: 2,
  },
  bodyText: {
    fontFamily: SANS,
    fontSize: 14,
    color: 'var(--tx2)',
    lineHeight: 1.6,
  },

  // Pill
  pill: {
    display: 'inline-block',
    fontFamily: MONO,
    fontSize: 12,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '4px 10px',
    borderRadius: 20,
    whiteSpace: 'nowrap',
  },

  // Chart legend
  chartLegend: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontFamily: MONO,
    fontSize: 12,
    color: 'var(--tx3)',
    marginTop: 6,
  },
  legendDot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    marginRight: 4,
  },

  // Stats row
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
  },
  statChip: {
    background: 'var(--bgc)',
    border: '1px solid var(--bd)',
    borderRadius: 12,
    padding: '12px 14px',
    textAlign: 'center',
  },
  statLabel: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--tx3)',
    marginBottom: 4,
  },
  statValue: {
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--tx)',
  },

  // Buttons
  btnRow: {
    display: 'flex',
    gap: 10,
    marginTop: 4,
  },
  btnPrimary: {
    flex: 1,
    padding: '13px 0',
    background: 'var(--pk)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  },
  btnSecondary: {
    flex: 1,
    padding: '13px 0',
    background: 'var(--bgc)',
    color: 'var(--tx2)',
    border: '1px solid var(--bds)',
    borderRadius: 12,
    fontFamily: MONO,
    fontSize: 12,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  },
};
