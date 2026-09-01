import { useParams } from 'react-router-dom'
import { wikiBase, coursePath, courseSubPath } from '../../courseRoutes'

// The wiki link base for the course in the URL. Every Field Guide surface
// mounts under /academic/:courseCode/…, so components keep writing
// `${WIKI_BASE}/${slug}` exactly as they did when WIKI_BASE was a constant —
// they just get the value from this hook instead of an import:
//
//   const WIKI_BASE = useWikiBase()
//
// (The old constant '/academic/fieldguide/wiki' still exists as a live shim
// route for sent-email links, but nothing should generate new links to it.)
export function useWikiBase() {
  const { courseCode } = useParams()
  return wikiBase(courseCode)
}

// Sibling convenience for the non-wiki links on Field Guide pages: the course
// home and its other surfaces, bound to the course in the URL.
export function useCoursePaths() {
  const { courseCode } = useParams()
  return {
    home: coursePath(courseCode),
    sub: (seg) => courseSubPath(courseCode, seg),
  }
}
