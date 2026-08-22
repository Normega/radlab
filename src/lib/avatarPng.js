import { supabase } from './supabase'

/**
 * Rasterize a rendered RippleAvatar <svg> to PNG and upload it to the public
 * avatar-png bucket as {userId}.png (2026-08-22). Emails can't render the
 * React SVG, so reminder emails reference this raster instead — see
 * supabase/functions/ripple_reminder. Callers treat failure as non-fatal:
 * the avatar save itself must never be blocked by the raster upload.
 *
 * 224×224 canvas: the SVG viewBox is 200×185 rendered in a square, matching
 * how RippleAvatar displays in-app; transparent background so the email's
 * white card shows through.
 */
export async function uploadAvatarPng(svgEl, userId) {
  if (!svgEl || !userId) return { ok: false, error: 'missing svg or userId' }
  try {
    const xml = new XMLSerializer().serializeToString(svgEl)
    const svgUrl = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }))
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error('svg rasterize failed'))
      img.src = svgUrl
    })
    const SIZE = 224
    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    canvas.getContext('2d').drawImage(img, 0, 0, SIZE, SIZE)
    URL.revokeObjectURL(svgUrl)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return { ok: false, error: 'canvas toBlob returned null' }
    const { error } = await supabase.storage
      .from('avatar-png')
      .upload(`${userId}.png`, blob, { contentType: 'image/png', upsert: true })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e?.message ?? String(e) }
  }
}
