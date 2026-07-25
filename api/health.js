// First serverless function in the repo. Exists to verify that Vercel
// matches /api functions before the SPA rewrite in vercel.json (which sends
// every path to index.html) — confirm this returns JSON, not the SPA shell,
// before building the real ingest function on top of the same routing.
export default function handler(req, res) {
  res.status(200).json({ ok: true, service: 'radlab', time: new Date().toISOString() })
}
