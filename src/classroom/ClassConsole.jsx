import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import ConsoleLecturePlanner from './ConsoleLecturePlanner'

// Desktop planning surface — lecture/check-in authoring only. Live controls
// (open/close/results) live on the remote (WP3b), not here.
export default function ClassConsole({ session }) {
  const { slug } = useParams()
  const [classInfo, setClassInfo] = useState(undefined)

  useEffect(() => {
    let cancelled = false
    supabase.from('classes').select('id, name, slug').eq('slug', slug).maybeSingle().then(({ data }) => {
      if (!cancelled) setClassInfo(data ?? null)
    })
    return () => { cancelled = true }
  }, [slug])

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />
      <div style={S.wrap}>
        {classInfo && <ConsoleLecturePlanner classInfo={classInfo} />}
      </div>
    </div>
  )
}

const S = {
  wrap: { maxWidth: 820, margin: '0 auto', padding: '40px 24px' },
}
