import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { titleFor } from './titleFor.js'

/**
 * RouteTitle — per-route document.title, one central matcher (2026-08-22).
 * With ~140 routes, titles live here rather than in each page: first exact
 * match wins, then the longest matching prefix, else the site default.
 * Fixes six-identical-tabs syndrome; also what browser history shows.
 * Nothing else on the site writes document.title — keep it that way, or a
 * navigation will silently overwrite a page's hand-set title.
 *
 * The matcher itself lives in routeTitle.js (pure, unit-tested); this file
 * is only the React binding.
 */
export default function RouteTitle() {
  const { pathname } = useLocation()
  useEffect(() => { document.title = titleFor(pathname) }, [pathname])
  return null
}
