// Drawing module for ColorMax — verbatim from aptitudesuite3_drawings.js.
// DO NOT modify coordinates, colors, or region order.
// Region order determines topmost-fill-wins behavior on the reference canvas.

export const COLORS = [
  { n: 1, hex: '#E24B4A', name: 'red'    },
  { n: 2, hex: '#EF9F27', name: 'orange' },
  { n: 3, hex: '#EAC700', name: 'yellow' },
  { n: 4, hex: '#639922', name: 'green'  },
  { n: 5, hex: '#378ADD', name: 'blue'   },
  { n: 6, hex: '#7F77DD', name: 'purple' },
]
export const W = 380
export const H = 430

let REF_MODE = false

function OL(ctx) {
  if (REF_MODE) return
  ctx.strokeStyle = '#1e1e1e'
  ctx.lineWidth = 2.5
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.stroke()
}
function FL(ctx, hex, isRef) {
  ctx.fillStyle = isRef ? hex : '#ffffff'
  ctx.fill()
}
function LB(ctx, x, y, n, isRef) {
  if (isRef) return
  ctx.save()
  ctx.font = 'bold 12px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 3
  ctx.strokeText(n, x, y)
  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.fillText(n, x, y)
  ctx.restore()
}

export function drawPage(ctx, idx, isRef) {
  REF_MODE = isRef
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ;[drawDuck, drawBarn, drawButterfly, drawApple, drawSunflower][idx](ctx, isRef)
}

// ---------- 1. Duck (rubber duck on water) ----------
function drawDuck(ctx, isRef) {
  const C = COLORS
  ctx.save()

  // Water
  ctx.beginPath()
  ctx.rect(25, 348, 330, 50)
  FL(ctx, C[4].hex, isRef); OL(ctx)
  LB(ctx, 60, 388, 5, isRef)
  LB(ctx, 320, 388, 5, isRef)

  // Body with upswept tail
  ctx.beginPath()
  ctx.moveTo(100, 280)
  ctx.bezierCurveTo(95, 340, 150, 362, 210, 360)
  ctx.bezierCurveTo(262, 358, 292, 336, 297, 300)
  ctx.bezierCurveTo(330, 292, 342, 254, 322, 238)
  ctx.bezierCurveTo(302, 248, 280, 260, 258, 263)
  ctx.bezierCurveTo(208, 268, 138, 258, 100, 280)
  ctx.closePath()
  FL(ctx, C[2].hex, isRef); OL(ctx)
  LB(ctx, 130, 310, 3, isRef)
  LB(ctx, 290, 290, 3, isRef)

  // Head (overlapping body so they connect)
  ctx.beginPath()
  ctx.arc(148, 212, 58, 0, Math.PI * 2)
  FL(ctx, C[2].hex, isRef); OL(ctx)
  LB(ctx, 170, 218, 3, isRef)

  // Bill
  ctx.beginPath()
  ctx.moveTo(96, 196)
  ctx.bezierCurveTo(68, 188, 46, 196, 44, 210)
  ctx.bezierCurveTo(48, 224, 74, 227, 96, 219)
  ctx.closePath()
  FL(ctx, C[1].hex, isRef); OL(ctx)
  LB(ctx, 68, 208, 2, isRef)

  // Wing
  ctx.beginPath()
  ctx.ellipse(210, 300, 55, 34, -0.18, 0, Math.PI * 2)
  FL(ctx, C[1].hex, isRef); OL(ctx)
  LB(ctx, 210, 300, 2, isRef)

  // Eye (visible only; not a scoring region)
  if (!isRef) {
    ctx.beginPath()
    ctx.arc(130, 196, 6.5, 0, Math.PI * 2)
    ctx.fillStyle = '#1e1e1e'; ctx.fill()
  }

  ctx.restore()
}

// ---------- 2. Barn ----------
function drawBarn(ctx, isRef) {
  const C = COLORS
  ctx.save()

  // Sun
  ctx.beginPath()
  ctx.arc(315, 85, 28, 0, Math.PI * 2)
  FL(ctx, C[2].hex, isRef); OL(ctx)
  LB(ctx, 315, 85, 3, isRef)

  // Grass
  ctx.beginPath()
  ctx.rect(28, 375, 324, 28)
  FL(ctx, C[3].hex, isRef); OL(ctx)
  LB(ctx, 60, 389, 4, isRef)
  LB(ctx, 320, 389, 4, isRef)

  // Roof
  ctx.beginPath()
  ctx.moveTo(60, 215)
  ctx.lineTo(190, 92)
  ctx.lineTo(320, 215)
  ctx.closePath()
  FL(ctx, C[1].hex, isRef); OL(ctx)
  LB(ctx, 128, 196, 2, isRef)
  LB(ctx, 252, 196, 2, isRef)

  // Walls
  ctx.beginPath()
  ctx.rect(85, 215, 210, 160)
  FL(ctx, C[0].hex, isRef); OL(ctx)
  LB(ctx, 120, 330, 1, isRef)
  LB(ctx, 260, 330, 1, isRef)

  // Round loft window (on roof)
  ctx.beginPath()
  ctx.arc(190, 178, 19, 0, Math.PI * 2)
  FL(ctx, C[4].hex, isRef); OL(ctx)
  LB(ctx, 190, 178, 5, isRef)

  // Left window
  ctx.beginPath()
  ctx.rect(102, 240, 54, 46)
  FL(ctx, C[4].hex, isRef); OL(ctx)
  LB(ctx, 129, 263, 5, isRef)

  // Right window
  ctx.beginPath()
  ctx.rect(224, 240, 54, 46)
  FL(ctx, C[4].hex, isRef); OL(ctx)
  LB(ctx, 251, 263, 5, isRef)

  // Door
  ctx.beginPath()
  ctx.rect(155, 292, 70, 83)
  FL(ctx, C[2].hex, isRef); OL(ctx)
  LB(ctx, 190, 334, 3, isRef)

  ctx.restore()
}

// ---------- 3. Butterfly ----------
function drawButterfly(ctx, isRef) {
  const C = COLORS
  ctx.save()
  const cx = 190, cy = 215

  // Upper wings (orange)
  ctx.beginPath()
  ctx.ellipse(cx - 55, cy - 55, 52, 70, 0.35, 0, Math.PI * 2)
  FL(ctx, C[1].hex, isRef); OL(ctx)
  LB(ctx, cx - 88, cy - 92, 2, isRef)
  ctx.beginPath()
  ctx.ellipse(cx + 55, cy - 55, 52, 70, -0.35, 0, Math.PI * 2)
  FL(ctx, C[1].hex, isRef); OL(ctx)
  LB(ctx, cx + 88, cy - 92, 2, isRef)

  // Lower wings (orange)
  ctx.beginPath()
  ctx.ellipse(cx - 48, cy + 62, 44, 56, -0.3, 0, Math.PI * 2)
  FL(ctx, C[1].hex, isRef); OL(ctx)
  LB(ctx, cx - 72, cy + 104, 2, isRef)
  ctx.beginPath()
  ctx.ellipse(cx + 48, cy + 62, 44, 56, 0.3, 0, Math.PI * 2)
  FL(ctx, C[1].hex, isRef); OL(ctx)
  LB(ctx, cx + 72, cy + 104, 2, isRef)

  // Upper wing inner spots (blue)
  ctx.beginPath()
  ctx.ellipse(cx - 55, cy - 55, 26, 38, 0.35, 0, Math.PI * 2)
  FL(ctx, C[4].hex, isRef); OL(ctx)
  LB(ctx, cx - 55, cy - 55, 5, isRef)
  ctx.beginPath()
  ctx.ellipse(cx + 55, cy - 55, 26, 38, -0.35, 0, Math.PI * 2)
  FL(ctx, C[4].hex, isRef); OL(ctx)
  LB(ctx, cx + 55, cy - 55, 5, isRef)

  // Lower wing spots (yellow)
  ctx.beginPath()
  ctx.arc(cx - 46, cy + 60, 20, 0, Math.PI * 2)
  FL(ctx, C[2].hex, isRef); OL(ctx)
  LB(ctx, cx - 46, cy + 60, 3, isRef)
  ctx.beginPath()
  ctx.arc(cx + 46, cy + 60, 20, 0, Math.PI * 2)
  FL(ctx, C[2].hex, isRef); OL(ctx)
  LB(ctx, cx + 46, cy + 60, 3, isRef)

  // Body (purple)
  ctx.beginPath()
  ctx.ellipse(cx, cy + 8, 13, 84, 0, 0, Math.PI * 2)
  FL(ctx, C[5].hex, isRef); OL(ctx)
  LB(ctx, cx, cy + 8, 6, isRef)

  // Head (purple)
  ctx.beginPath()
  ctx.arc(cx, cy - 88, 14, 0, Math.PI * 2)
  FL(ctx, C[5].hex, isRef); OL(ctx)
  LB(ctx, cx, cy - 88, 6, isRef)

  // Antennae (visible only; not a scoring region)
  if (!isRef) {
    ctx.beginPath()
    ctx.moveTo(cx - 5, cy - 100)
    ctx.bezierCurveTo(cx - 18, cy - 126, cx - 34, cy - 132, cx - 32, cy - 138)
    ctx.moveTo(cx + 5, cy - 100)
    ctx.bezierCurveTo(cx + 18, cy - 126, cx + 34, cy - 132, cx + 32, cy - 138)
    ctx.strokeStyle = '#1e1e1e'; ctx.lineWidth = 2; ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx - 32, cy - 139, 4.5, 0, Math.PI * 2)
    ctx.arc(cx + 32, cy - 139, 4.5, 0, Math.PI * 2)
    ctx.fillStyle = '#1e1e1e'; ctx.fill()
  }

  ctx.restore()
}

// ---------- 4. Apple and plum on a table ----------
function drawApple(ctx, isRef) {
  const C = COLORS
  ctx.save()

  // Table
  ctx.beginPath()
  ctx.rect(35, 360, 310, 32)
  FL(ctx, C[2].hex, isRef); OL(ctx)
  LB(ctx, 70, 376, 3, isRef)
  LB(ctx, 340, 376, 3, isRef)

  // Apple body
  ctx.beginPath()
  ctx.moveTo(155, 150)
  ctx.bezierCurveTo(190, 120, 245, 140, 240, 200)
  ctx.bezierCurveTo(237, 250, 226, 290, 221, 320)
  ctx.bezierCurveTo(216, 352, 190, 362, 155, 362)
  ctx.bezierCurveTo(120, 362, 94, 352, 89, 320)
  ctx.bezierCurveTo(84, 290, 73, 250, 70, 200)
  ctx.bezierCurveTo(65, 140, 120, 120, 155, 150)
  ctx.closePath()
  FL(ctx, C[0].hex, isRef); OL(ctx)
  LB(ctx, 155, 255, 1, isRef)

  // Stem
  ctx.beginPath()
  ctx.moveTo(149, 152)
  ctx.bezierCurveTo(147, 130, 151, 114, 158, 106)
  ctx.lineTo(171, 111)
  ctx.bezierCurveTo(163, 121, 160, 138, 162, 152)
  ctx.closePath()
  FL(ctx, C[3].hex, isRef); OL(ctx)
  LB(ctx, 158, 128, 4, isRef)

  // Leaf
  ctx.beginPath()
  ctx.ellipse(202, 116, 33, 14, -0.45, 0, Math.PI * 2)
  FL(ctx, C[3].hex, isRef); OL(ctx)
  LB(ctx, 202, 116, 4, isRef)

  // Plum
  ctx.beginPath()
  ctx.arc(290, 318, 42, 0, Math.PI * 2)
  FL(ctx, C[5].hex, isRef); OL(ctx)
  LB(ctx, 290, 318, 6, isRef)

  // Plum stem
  ctx.beginPath()
  ctx.rect(286, 260, 7, 17)
  FL(ctx, C[3].hex, isRef); OL(ctx)

  ctx.restore()
}

// ---------- 5. Sunflower in a pot ----------
function drawSunflower(ctx, isRef) {
  const C = COLORS
  ctx.save()
  const cx = 190, cy = 168

  // Petals
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const bx = cx + Math.cos(a) * 72
    const by = cy + Math.sin(a) * 72
    ctx.beginPath()
    ctx.ellipse(bx, by, 16, 30, a + Math.PI / 2, 0, Math.PI * 2)
    FL(ctx, C[2].hex, isRef); OL(ctx)
    if (i === 0 || i === 3 || i === 6 || i === 9) LB(ctx, bx + Math.cos(a) * 12, by + Math.sin(a) * 12, 3, isRef)
  }

  // Ring (orange)
  ctx.beginPath()
  ctx.arc(cx, cy, 50, 0, Math.PI * 2)
  FL(ctx, C[1].hex, isRef); OL(ctx)
  LB(ctx, cx, cy - 41, 2, isRef)

  // Centre (red)
  ctx.beginPath()
  ctx.arc(cx, cy, 32, 0, Math.PI * 2)
  FL(ctx, C[0].hex, isRef); OL(ctx)
  LB(ctx, cx, cy, 1, isRef)

  // Stem
  ctx.beginPath()
  ctx.moveTo(cx - 8, cy + 50)
  ctx.bezierCurveTo(cx - 12, cy + 90, cx - 12, cy + 120, cx - 10, cy + 154)
  ctx.lineTo(cx + 10, cy + 154)
  ctx.bezierCurveTo(cx + 12, cy + 120, cx + 12, cy + 90, cx + 8, cy + 50)
  ctx.closePath()
  FL(ctx, C[3].hex, isRef); OL(ctx)
  LB(ctx, cx, cy + 135, 4, isRef)

  // Left leaf
  ctx.beginPath()
  ctx.moveTo(cx - 9, cy + 100)
  ctx.bezierCurveTo(cx - 42, cy + 90, cx - 72, cy + 85, cx - 80, cy + 98)
  ctx.bezierCurveTo(cx - 66, cy + 110, cx - 40, cy + 112, cx - 9, cy + 118)
  ctx.closePath()
  FL(ctx, C[3].hex, isRef); OL(ctx)
  LB(ctx, cx - 48, cy + 99, 4, isRef)

  // Right leaf
  ctx.beginPath()
  ctx.moveTo(cx + 9, cy + 100)
  ctx.bezierCurveTo(cx + 42, cy + 90, cx + 72, cy + 85, cx + 80, cy + 98)
  ctx.bezierCurveTo(cx + 66, cy + 110, cx + 40, cy + 112, cx + 9, cy + 118)
  ctx.closePath()
  FL(ctx, C[3].hex, isRef); OL(ctx)
  LB(ctx, cx + 48, cy + 99, 4, isRef)

  // Pot rim
  ctx.beginPath()
  ctx.rect(143, 322, 94, 16)
  FL(ctx, C[4].hex, isRef); OL(ctx)
  LB(ctx, 190, 330, 5, isRef)

  // Pot body
  ctx.beginPath()
  ctx.moveTo(150, 338)
  ctx.lineTo(230, 338)
  ctx.lineTo(218, 404)
  ctx.lineTo(162, 404)
  ctx.closePath()
  FL(ctx, C[4].hex, isRef); OL(ctx)
  LB(ctx, 190, 370, 5, isRef)

  ctx.restore()
}
