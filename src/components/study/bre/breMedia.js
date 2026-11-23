// Loads and preloads the clips and audio a task needs before it starts (plan §8), so a clip pair plays
// back to back with no gap and nothing buffers mid-task. Clips come from the video library folder
// "ER Clips" (titled by REB clip id), audio from "ER Audio" (titled by key); both buckets are private,
// so each file gets a signed URL long enough for a session.

const SIGN_SECONDS = 4 * 3600

async function signed(db, table, folder, titles, bucket) {
  if (!titles.length) return {}
  const { data: rows, error } = await db.from(table).select('title, storage_path').eq('folder', folder).in('title', titles)
  if (error) throw error
  const byTitle = Object.fromEntries((rows ?? []).map(r => [r.title, r.storage_path]))
  const missing = titles.filter(t => !byTitle[t])
  if (missing.length) throw new Error(`missing from ${folder}: ${missing.join(', ')}`)
  const paths = titles.map(t => byTitle[t])
  const { data, error: sErr } = await db.storage.from(bucket).createSignedUrls(paths, SIGN_SECONDS)
  if (sErr) throw sErr
  const out = {}
  titles.forEach((t, i) => {
    const url = data?.[i]?.signedUrl
    if (!url) throw new Error(`could not sign ${t}`)
    out[t] = url
  })
  return out
}

function preload(el, url) {
  return new Promise((resolve, reject) => {
    const done = () => { cleanup(); resolve(el) }
    const fail = () => { cleanup(); reject(new Error(`could not load ${url.split('?')[0].split('/').pop()}`)) }
    const cleanup = () => { el.removeEventListener('canplaythrough', done); el.removeEventListener('error', fail) }
    el.addEventListener('canplaythrough', done)
    el.addEventListener('error', fail)
    el.preload = 'auto'
    el.src = url
    el.load()
  })
}

/** { videos: {A1: HTMLVideoElement}, audios: {bre_cue_sf: HTMLAudioElement} }, all ready to play. */
export async function loadBreMedia(db, { clips = [], audios = [] }) {
  const [vUrls, aUrls] = await Promise.all([
    signed(db, 'video_library', 'ER Clips', clips, 'videos'),
    signed(db, 'study_audios', 'ER Audio', audios, 'audios'),
  ])
  const videos = {}
  const audioEls = {}
  await Promise.all([
    ...clips.map(async (id) => {
      const v = document.createElement('video')
      v.playsInline = true
      v.disablePictureInPicture = true
      v.controls = false
      v.setAttribute('aria-label', 'Film clip')
      v.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000;display:block'
      videos[id] = await preload(v, vUrls[id])
    }),
    ...audios.map(async (key) => { audioEls[key] = await preload(new Audio(), aUrls[key]) }),
  ])
  return { videos, audios: audioEls }
}
