import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TaskPreviewPlayer from '../components/tasks/TaskPreviewPlayer'
import { taskInfo } from '../components/tasks/taskRegistry'

// Task preview (website.md §25a). Two routes:
//   /preview/:token            — a share link a lab member issued from
//                                /admin/tasks. No account needed; the token is
//                                checked by open_task_preview.
//   /admin/tasks/preview/:slug — the lab's own preview, behind AdminRoute.
// Either way the game runs against a stub client, so nothing is saved.

const MESSAGES = {
  not_found: 'This preview link isn’t valid. Check that the whole link was copied.',
  expired:   'This preview link has expired. Ask the person who sent it for a new one.',
  revoked:   'This preview link has been turned off. Ask the person who sent it for a new one.',
  error:     'This preview couldn’t load. Check your connection and reload the page.',
}

export default function TaskPreview() {
  const { token, slug } = useParams()
  // Lab route: nothing to look up.
  const [link, setLink] = useState(slug ? { state: 'ok', game_slug: slug, quick_demo: false } : null)

  useEffect(() => {
    if (!token) return
    let live = true
    supabase.rpc('open_task_preview', { p_token: token }).then(({ data, error }) => {
      if (!live) return
      setLink(error || !data ? { state: 'error' } : data)
    })
    return () => { live = false }
  }, [token])

  if (!link) return null

  if (link.state !== 'ok') {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <img src="/RADlab_Logo.svg" alt="RADlab" style={S.logo} />
          <p style={S.msg}>{MESSAGES[link.state] ?? MESSAGES.not_found}</p>
        </div>
      </div>
    )
  }

  return (
    <TaskPreviewPlayer
      slug={link.game_slug}
      name={taskInfo(link.game_slug).name}
      quickDemo={!!link.quick_demo}
    />
  )
}

const S = {
  page: {
    minHeight: '100vh', background: 'var(--bg)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  card: {
    maxWidth: 400, width: '100%', padding: 32,
    background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12,
    textAlign: 'center',
  },
  logo: { height: 32, marginBottom: 16 },
  msg: {
    margin: 0, fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 16, lineHeight: 1.5, color: 'var(--tx)',
  },
}
