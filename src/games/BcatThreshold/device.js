// ── BCAT threshold: device check ────────────────────────────────────────────
//
// Pure and node-testable (device.test.mjs); readDeviceEnv() is the only part that touches the browser.
// The rule is the test build's (6_online_pilot/js/app.js, deviceProblem): no phones or tablets, a screen of
// at least 800 x 500. A physical keyboard cannot be detected; the texts ask for one and the practice needs
// it (W, S and the arrow keys). One addition: iPadOS Safari reports a Mac user agent, so a "Mac" with a
// multi-touch screen and no fine pointer counts as a tablet.

export const MIN_SCREEN = Object.freeze({ w: 800, h: 500 })

/**
 * @param {{ userAgent?: string, uaDataMobile?: boolean, hasTouch?: boolean, finePointer?: boolean,
 *           maxTouchPoints?: number, screenW?: number, screenH?: number }} env
 * @returns {null | 'mobile' | 'small_screen'}
 */
export function deviceProblem(env, min = MIN_SCREEN) {
  const ua = String(env.userAgent || '')
  const mobileUa = !!env.uaDataMobile || /Mobi|Android|iPhone|iPad|iPod/i.test(ua)
  const touchOnly = !!env.hasTouch && !env.finePointer
  const iPadAsMac = /Macintosh/.test(ua) && Number(env.maxTouchPoints) > 1 && !env.finePointer
  if (mobileUa || touchOnly || iPadAsMac) return 'mobile'
  if (Number(env.screenW) < min.w || Number(env.screenH) < min.h) return 'small_screen'
  return null
}

/** The facts deviceProblem needs, read from this browser. */
export function readDeviceEnv(w = globalThis.window) {
  const nav = w.navigator || {}
  const fine = typeof w.matchMedia === 'function' ? w.matchMedia('(pointer: fine)').matches : true
  return {
    userAgent: nav.userAgent || '',
    uaDataMobile: !!(nav.userAgentData && nav.userAgentData.mobile),
    hasTouch: 'ontouchstart' in w,
    finePointer: fine,
    maxTouchPoints: Number(nav.maxTouchPoints) || 0,
    screenW: w.screen ? w.screen.width : 0,
    screenH: w.screen ? w.screen.height : 0,
  }
}
