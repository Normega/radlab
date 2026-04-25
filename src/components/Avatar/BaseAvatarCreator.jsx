import { useState } from "react";

// ── Color utilities ──────────────────────────────────────────────────────
function hex2rgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgb2hex(r, g, b) {
  return "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
}
function lighten(hex, amt) {
  const [r, g, b] = hex2rgb(hex);
  return rgb2hex(r + amt, g + amt, b + amt);
}
function darken(hex, amt) {
  return lighten(hex, -amt);
}
function mix(a, b, t) {
  const [r1, g1, b1] = hex2rgb(a);
  const [r2, g2, b2] = hex2rgb(b);
  return rgb2hex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

// ── Palette ──────────────────────────────────────────────────────────────
const SKIN_COLORS = [
  { hex: "#FFEEE8", label: "Porcelain" },
  { hex: "#FDBCB4", label: "Peach" },
  { hex: "#F5CBA7", label: "Sand" },
  { hex: "#E8B08A", label: "Honey" },
  { hex: "#C68642", label: "Caramel" },
  { hex: "#8D5524", label: "Chestnut" },
  { hex: "#4A2912", label: "Espresso" },
  // fantasy
  { hex: "#D4B8E0", label: "Lavender" },
  { hex: "#A8D8EA", label: "Sky" },
  { hex: "#B5EAD7", label: "Mint" },
  { hex: "#FFD6A5", label: "Buttercup" },
  { hex: "#C9B1D0", label: "Dusk" },
  { hex: "#8ECAE6", label: "Ocean" },
  { hex: "#95D5B2", label: "Jade" },
  { hex: "#E8C1C1", label: "Rose" },
  { hex: "#BDE0FE", label: "Periwinkle" },
];

const EYE_COLORS = [
  { hex: "#6B4F3A", label: "Warm Brown" },
  { hex: "#3D2B1F", label: "Dark Brown" },
  { hex: "#8B7355", label: "Hazel" },
  { hex: "#4A90D9", label: "Sky Blue" },
  { hex: "#1C5FA0", label: "Deep Blue" },
  { hex: "#4A8B5A", label: "Forest" },
  { hex: "#2D6A4F", label: "Dark Green" },
  { hex: "#7B4FCF", label: "Purple" },
  { hex: "#FFBF00", label: "Amber" },
  { hex: "#CC2200", label: "Red" },
  { hex: "#00897B", label: "Teal" },
  { hex: "#F06292", label: "Pink" },
  { hex: "#546E7A", label: "Steel" },
  { hex: "#8B008B", label: "Violet" },
  { hex: "#FF8C00", label: "Ember" },
  { hex: "#2E7D32", label: "Moss" },
];

// ── Base Avatar SVG ──────────────────────────────────────────────────────
function BaseAvatar({ skinColor, eyeColor, size = 200 }) {
  const skin     = skinColor;
  const skinDark = darken(skin, 18);
  const skinMid  = darken(skin, 9);
  const skinLit  = lighten(skin, 18);
  const blush    = mix(skin, "#FF8FAB", 0.45);
  const iris     = eyeColor;
  const irisDeep = darken(eyeColor, 30);
  const irisLit  = lighten(eyeColor, 35);

  return (
    <svg
      viewBox="0 0 200 185"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      style={{ display: "block" }}
    >
      <defs>
        <radialGradient id="headG" cx="38%" cy="30%" r="68%">
          <stop offset="0%"   stopColor={skinLit} />
          <stop offset="60%"  stopColor={skin} />
          <stop offset="100%" stopColor={skinDark} />
        </radialGradient>
        <radialGradient id="irisG" cx="35%" cy="30%" r="65%">
          <stop offset="0%"   stopColor={irisLit} />
          <stop offset="55%"  stopColor={iris} />
          <stop offset="100%" stopColor={irisDeep} />
        </radialGradient>
        <radialGradient id="scleraG" cx="40%" cy="30%" r="60%">
          <stop offset="0%"   stopColor="#ffffff" />
          <stop offset="100%" stopColor="#F0EBE8" />
        </radialGradient>
        <filter id="softBlur">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        <filter id="eyeShadow">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor={skinDark} floodOpacity="0.25" />
        </filter>
        <clipPath id="leftEyeClip">
          <circle cx="76" cy="100" r="17" />
        </clipPath>
        <clipPath id="rightEyeClip">
          <circle cx="124" cy="100" r="17" />
        </clipPath>
      </defs>

      {/* ── Head — rounder, more cartoony ── */}
      <ellipse cx="100" cy="105" rx="64" ry="68" fill="url(#headG)" />

      {/* ── Eyebrow left ── */}
      <path
        d="M 60 82 Q 76 77 90 81"
        stroke={skinDark} strokeWidth="3.5" fill="none"
        strokeLinecap="round" opacity="0.65"
      />
      {/* ── Eyebrow right ── */}
      <path
        d="M 110 81 Q 124 77 140 82"
        stroke={skinDark} strokeWidth="3.5" fill="none"
        strokeLinecap="round" opacity="0.65"
      />

      {/* ── Eye left ── */}
      <circle cx="76" cy="100" r="17" fill="url(#scleraG)" filter="url(#eyeShadow)" />
      <circle cx="76" cy="101" r="12" fill="url(#irisG)" clipPath="url(#leftEyeClip)" />
      <circle cx="76" cy="101" r="7" fill="#0D0D0D" clipPath="url(#leftEyeClip)" />
      <circle cx="70" cy="102" r="3.5" fill="white" opacity="0.95" />
      <circle cx="79" cy="108" r="1.8" fill="white" opacity="0.65" />
      {/* upper eyelid — top follows sclera arc, bottom edge droops into eye */}
      <path d="M 60 91 Q 76 94 92 91 A 17 17 0 0 0 60 91 Z" fill={skin} />
      {/* lash line */}
      <path d="M 60 91 Q 76 94 92 91" stroke={skinDark} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.6" />

      {/* ── Eye right ── */}
      <circle cx="124" cy="100" r="17" fill="url(#scleraG)" filter="url(#eyeShadow)" />
      <circle cx="124" cy="101" r="12" fill="url(#irisG)" clipPath="url(#rightEyeClip)" />
      <circle cx="124" cy="101" r="7" fill="#0D0D0D" clipPath="url(#rightEyeClip)" />
      <circle cx="118" cy="102" r="3.5" fill="white" opacity="0.95" />
      <circle cx="127" cy="108" r="1.8" fill="white" opacity="0.65" />
      {/* upper eyelid */}
      <path d="M 108 91 Q 124 94 140 91 A 17 17 0 0 0 108 91 Z" fill={skin} />
      <path d="M 108 91 Q 124 94 140 91" stroke={skinDark} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.6" />

      {/* ── Mouth: wide, nearly flat, slight upward tilt at corners ── */}
      <path
        d="M 82 145 Q 100 149 118 145"
        stroke={darken(mix(skin, "#C06070", 0.5), 18)}
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />

      {/* ── Blush ── */}
      <ellipse cx="62"  cy="120" rx="16" ry="8" fill={blush} opacity="0.42" filter="url(#softBlur)" />
      <ellipse cx="138" cy="120" rx="16" ry="8" fill={blush} opacity="0.42" filter="url(#softBlur)" />
    </svg>
  );
}

// ── Color Swatch ─────────────────────────────────────────────────────────
function Swatch({ color, label, active, onClick }) {
  return (
    <button
      title={label}
      onClick={onClick}
      style={{
        width: 36, height: 36,
        borderRadius: "50%",
        background: color.hex,
        border: active ? "3px solid #f068a4" : "3px solid transparent",
        outline: active ? "2px solid white" : "none",
        outlineOffset: "-5px",
        cursor: "pointer",
        boxShadow: active
          ? "0 0 0 2px #f068a4, 0 3px 10px rgba(0,0,0,0.22)"
          : "0 2px 8px rgba(0,0,0,0.18)",
        transform: active ? "scale(1.22)" : "scale(1)",
        transition: "all 0.16s ease",
        padding: 0,
        flexShrink: 0,
      }}
    />
  );
}

// ── Main ─────────────────────────────────────────────────────────────────
export default function BaseAvatarCreator() {
  const [skin, setSkin]     = useState(SKIN_COLORS[1]);   // Peach default
  const [eye,  setEye]      = useState(EYE_COLORS[3]);    // Sky Blue default
  const [saved, setSaved]   = useState(false);
  const [bump,  setBump]    = useState(0);

  function pick(setter, val) {
    setter(val);
    setSaved(false);
    setBump((b) => b + 1);
  }

  const panelStyle = {
    background: "white",
    borderRadius: 24,
    padding: "22px 24px",
    boxShadow: "0 4px 24px rgba(240,104,164,0.10)",
    marginBottom: 16,
  };
  const labelStyle = {
    fontFamily: '"Space Mono", monospace',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#abadb0",
    marginBottom: 12,
    display: "block",
  };
  const swatchRow = {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#FCF0F5",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 16px",
      fontFamily: '"DM Sans", sans-serif',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;1,400&family=DM+Serif+Display&family=Space+Mono:wght@700&display=swap');
        * { box-sizing: border-box; }
        @keyframes popIn {
          0%   { transform: scale(0.93) translateY(4px); opacity: 0.7; }
          65%  { transform: scale(1.03) translateY(-1px); }
          100% { transform: scale(1)    translateY(0);    opacity: 1; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ width: "100%", maxWidth: 780 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32, animation: "fadeUp 0.5s ease both" }}>
          <p style={{
            fontFamily: '"Space Mono", monospace',
            fontSize: 11, fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#f068a4",
            margin: "0 0 8px",
          }}>Come, See · Onboarding</p>
          <h1 style={{
            fontFamily: '"DM Serif Display", serif',
            fontSize: "clamp(28px, 5vw, 42px)",
            color: "#2D1B35",
            margin: "0 0 10px",
            letterSpacing: "-0.5px",
            lineHeight: 1.1,
          }}>
            This is you.
          </h1>
          <p style={{
            color: "#abadb0",
            fontSize: 15,
            margin: 0,
            maxWidth: 400,
            marginInline: "auto",
            lineHeight: 1.55,
          }}>
            Start with your base avatar. As you explore and complete activities,
            you'll unlock new features to make it your own.
          </p>
        </div>

        {/* Layout */}
        <div style={{
          display: "flex",
          gap: 24,
          alignItems: "flex-start",
          flexWrap: "wrap",
          animation: "fadeUp 0.5s 0.1s ease both",
        }}>

          {/* Avatar preview */}
          <div style={{
            flex: "0 0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
          }}>
            <div style={{
              background: "white",
              borderRadius: 32,
              padding: 16,
              boxShadow: "0 8px 40px rgba(240,104,164,0.20)",
              width: 220,
              height: 220,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}>
              <div
                key={bump}
                style={{ animation: "popIn 0.32s ease both" }}
              >
                <BaseAvatar skinColor={skin.hex} eyeColor={eye.hex} size={200} />
              </div>
            </div>

            {/* Locked features hint */}
            <div style={{
              background: "white",
              borderRadius: 18,
              padding: "14px 16px",
              width: 220,
              boxShadow: "0 3px 14px rgba(240,104,164,0.10)",
            }}>
              <p style={{
                fontFamily: '"Space Mono", monospace',
                fontSize: 10, fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#f068a4",
                margin: "0 0 10px",
              }}>Unlocked by exploring</p>
              {[
                { icon: "👂", label: "Ears & species", pts: 50 },
                { icon: "👃", label: "Nose styles",   pts: 100 },
                { icon: "💇", label: "Hair",           pts: 150 },
                { icon: "😄", label: "Mouth styles",  pts: 200 },
                { icon: "✨", label: "Auras & extras", pts: 300 },
                { icon: "🔱", label: "Scars & marks",  pts: 500 },
              ].map((item) => (
                <div key={item.label} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 7,
                  opacity: 0.55,
                }}>
                  <span style={{ fontSize: 13 }}>{item.icon}</span>
                  <span style={{ fontSize: 12, color: "#555", flex: 1 }}>{item.label}</span>
                  <span style={{
                    fontFamily: '"Space Mono", monospace',
                    fontSize: 10,
                    color: "#abadb0",
                    background: "#FCF0F5",
                    borderRadius: 6,
                    padding: "1px 6px",
                  }}>{item.pts}pts</span>
                </div>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div style={{ flex: 1, minWidth: 280 }}>

            {/* Skin color */}
            <div style={panelStyle}>
              <span style={labelStyle}>Skin · Fur · Scales</span>
              <div style={swatchRow}>
                {SKIN_COLORS.map((c) => (
                  <Swatch
                    key={c.hex}
                    color={c}
                    label={c.label}
                    active={skin.hex === c.hex}
                    onClick={() => pick(setSkin, c)}
                  />
                ))}
              </div>
              <p style={{
                marginTop: 12, marginBottom: 0,
                fontSize: 12, color: "#abadb0", fontStyle: "italic",
              }}>
                Selected: <strong style={{ color: "#2D1B35", fontStyle: "normal" }}>{skin.label}</strong>
                {skin.hex.startsWith("#D4") || ["#A8D8EA","#B5EAD7","#FFD6A5","#C9B1D0","#8ECAE6","#95D5B2","#E8C1C1","#BDE0FE"].includes(skin.hex)
                  ? " · fantasy palette" : " · human palette"}
              </p>
            </div>

            {/* Eye color */}
            <div style={panelStyle}>
              <span style={labelStyle}>Eye color</span>
              <div style={swatchRow}>
                {EYE_COLORS.map((c) => (
                  <Swatch
                    key={c.hex}
                    color={c}
                    label={c.label}
                    active={eye.hex === c.hex}
                    onClick={() => pick(setEye, c)}
                  />
                ))}
              </div>
              <p style={{
                marginTop: 12, marginBottom: 0,
                fontSize: 12, color: "#abadb0", fontStyle: "italic",
              }}>
                Selected: <strong style={{ color: "#2D1B35", fontStyle: "normal" }}>{eye.label}</strong>
              </p>
            </div>

            {/* Save */}
            <button
              onClick={() => setSaved(true)}
              style={{
                width: "100%",
                padding: "14px 0",
                background: saved ? "#52B788" : "#f068a4",
                color: "white",
                border: "none",
                borderRadius: 16,
                fontFamily: '"Space Mono", monospace',
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "-0.2px",
                cursor: "pointer",
                transition: "background 0.4s ease",
                boxShadow: saved
                  ? "0 4px 20px rgba(82,183,136,0.35)"
                  : "0 4px 20px rgba(240,104,164,0.35)",
              }}
            >
              {saved ? "✓  Avatar saved — let's go!" : "Looks good — save my avatar"}
            </button>

            {saved && (
              <p style={{
                textAlign: "center",
                fontSize: 13,
                color: "#abadb0",
                marginTop: 12,
                animation: "fadeUp 0.3s ease both",
              }}>
                Your avatar will evolve as you complete games and activities.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
