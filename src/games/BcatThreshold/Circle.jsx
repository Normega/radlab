// The BCAT threshold circle: a plain pink disc (decision 9.1: no avatar face).
//
// Its box is the LARGEST size (config.display.circle_max_size, a fraction of the window height, as the test
// build), and the trial loop shrinks it with transform: scale(size / max) on every frame by writing to the
// element directly (trialLoop.js, presenter.js). React renders it once; nothing here re-renders per frame.
// The first paint is the still size, so the circle never flashes large.

export default function Circle({ ref, maxSize = 0.3, minSize = 0.1 }) {
  const d = `${(maxSize * 100).toFixed(3)}vh`
  return (
    <div className="bt-circle-wrap" aria-hidden="true">
      <div ref={ref} className="bt-circle" style={{ width: d, height: d, transform: `scale(${(minSize / maxSize).toFixed(5)})` }} />
    </div>
  )
}
