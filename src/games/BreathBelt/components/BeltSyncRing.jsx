import { useEffect, useRef } from 'react';

// ── BeltSyncRing ───────────────────────────────────────────────────────────
//
// Warm amber aura ring overlay that replaces the original OrangeCircle.
// Reads breathValueRef (0–1) on every rAF frame and exponentially smooths
// toward it — so the ring breathes naturally regardless of BT packet rate.
// Rendered as 3 concentric SVG rings behind the avatar.
//
// Props:
//   breathValueRef — Ref<number> from useBeltConnection
//   avatarSize     — px diameter of AvatarBreathPacer (default 240)

const RING_COUNT     = 3;
const RING_GAP_PX    = 10;   // gap between rings
const BASE_OFFSET_PX = 14;   // inner ring: avatarRadius + this
const MAX_EXPAND     = 0.15; // max outward expansion as fraction of avatarSize
const SMOOTH_ALPHA   = 0.10; // exponential smoothing factor

export default function BeltSyncRing({ breathValueRef, avatarSize = 240 }) {
  const ringsRef  = useRef([]);
  const rafRef    = useRef(null);
  const smoothRef = useRef(0);

  useEffect(() => {
    const avatarRadius = avatarSize / 2;
    const maxExpand    = avatarSize * MAX_EXPAND;

    function frame() {
      const target = breathValueRef.current ?? 0;
      smoothRef.current += (target - smoothRef.current) * SMOOTH_ALPHA;
      const v = smoothRef.current;

      for (let i = 0; i < RING_COUNT; i++) {
        const el = ringsRef.current[i];
        if (!el) continue;
        const baseR  = avatarRadius + BASE_OFFSET_PX + i * RING_GAP_PX;
        const r      = baseR + v * maxExpand;
        const size   = r * 2;
        const opacity = 0.20 + v * 0.50;
        el.style.width        = `${size}px`;
        el.style.height       = `${size}px`;
        el.style.opacity      = String(opacity);
        el.style.borderRadius = '50%';
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [breathValueRef, avatarSize]);

  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      {Array.from({ length: RING_COUNT }, (_, i) => (
        <div
          key={i}
          ref={el => { ringsRef.current[i] = el; }}
          style={{
            position:   'absolute',
            border:     '2px solid rgba(255, 140, 60, 0.75)',
            boxShadow:  '0 0 8px 3px rgba(255, 140, 60, 0.20)',
            willChange: 'width, height, opacity',
          }}
        />
      ))}
    </div>
  );
}
