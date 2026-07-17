import { useSearchParams } from 'react-router-dom'
import WelcomeFlow from '../../ripple/WelcomeFlow'

/**
 * Dev-only visual preview of the Phase 4 onboarding steps.
 * Route: /dev/onboarding-preview?step=welcome|data|demographics|ripple|finish
 * Mounts WelcomeFlow with a synthetic session: DB reads return nothing under
 * RLS (rendering defaults), writes fail — purely for layout QA.
 */
const FAKE_SESSION = { user: { id: '00000000-0000-0000-0000-000000000000', email: 'preview@dev.local', user_metadata: { display_name: 'Preview' } } }

export default function OnboardingPreview() {
  const [params] = useSearchParams()
  if (!import.meta.env.DEV) return <div style={{ padding: 40 }}>Dev only.</div>
  return <WelcomeFlow session={FAKE_SESSION} devInitialStep={params.get('step') || 'welcome'} />
}
