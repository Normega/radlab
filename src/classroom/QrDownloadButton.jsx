import { useRef } from 'react'
import QRCode from 'react-qr-code'

// Renders a link/button that exports `value` as a downloadable QR PNG —
// react-qr-code only gives an SVG, so this renders one off-screen purely as
// a source for canvas conversion. White background regardless of the
// pink-tinted live screen QR, since this is meant to be dropped into an
// arbitrary slide deck, not matched to the app's own palette. Reused as-is
// wherever a class needs an embeddable QR (console/admin now, the
// instructor onboarding pack later — see website.md roadmap).
export default function QrDownloadButton({ value, filename, size = 512, label = 'Download QR', style }) {
  const wrapRef = useRef(null)

  function handleDownload() {
    const svg = wrapRef.current?.querySelector('svg')
    if (!svg) return
    const svgString = new XMLSerializer().serializeToString(svg)
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)

    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size, size)
      ctx.drawImage(img, 0, 0, size, size)
      URL.revokeObjectURL(svgUrl)
      canvas.toBlob((blob) => {
        if (!blob) return
        const pngUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = pngUrl
        link.download = filename
        link.click()
        URL.revokeObjectURL(pngUrl)
      }, 'image/png')
    }
    img.src = svgUrl
  }

  return (
    <>
      <div ref={wrapRef} style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
        <QRCode value={value} size={size} fgColor="#1c1c1e" bgColor="#ffffff" />
      </div>
      <button type="button" onClick={handleDownload} style={{ ...S.btn, ...style }}>{label}</button>
    </>
  )
}

const S = {
  btn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--tx2)', padding: 0, fontFamily: '"DM Sans",system-ui,sans-serif' },
}
