import { useState } from 'react'
import PrimaryCTA from '../../components/ui/PrimaryCTA'
import SecondaryCTA from '../../components/ui/SecondaryCTA'
import ButtonNav from '../../components/ui/ButtonNav'
import EyebrowLabel from '../../components/ui/EyebrowLabel'
import FillableBox from '../../components/ui/FillableBox'
import Checkbox from '../../components/ui/Checkbox'
import NavigationIcon from '../../components/ui/NavigationIcon'
import OnboardingNavigation from '../../components/ui/OnboardingNavigation'
import Nav from '../../components/Nav'

/**
 * Dev-only preview of the Onboarding Redesign v1 primitives (Phase 2).
 * Route: /dev/ui-kit — guards with import.meta.env.DEV like VideoTest.
 */
export default function UiKit() {
  const [checked, setChecked] = useState(false)
  const [name, setName] = useState('')

  if (!import.meta.env.DEV) return <div style={{ padding: 40 }}>Dev only.</div>

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={null} />
      <div style={S.page}>
        <h1 style={S.h1}>UI Kit — Phase 2 primitives</h1>

        <Section title="Button/PrimaryCTA (BgPink · BgWhite · Inactive)">
          <PrimaryCTA onClick={() => {}}>Join free</PrimaryCTA>
          <span style={S.onPink}>
            <PrimaryCTA variant="white" onClick={() => {}}>Join free</PrimaryCTA>
          </span>
          <PrimaryCTA disabled>Agree &amp; continue</PrimaryCTA>
        </Section>

        <Section title="Button/SecondaryCTA · ButtonNav (default · active · inert)">
          <SecondaryCTA onClick={() => {}}>Log in</SecondaryCTA>
          <ButtonNav onClick={() => {}}>Games</ButtonNav>
          <ButtonNav active onClick={() => {}}>Dashboard</ButtonNav>
          <ButtonNav inert>Dashboard</ButtonNav>
        </Section>

        <Section title="EyebrowLabel (BgPink · BgWhite · NoBg)">
          <EyebrowLabel>RADLAB GAMES PLATFORM</EyebrowLabel>
          <EyebrowLabel variant="white">STEP 1 OF 3</EyebrowLabel>
          <EyebrowLabel variant="nobg">ALMOST THERE</EyebrowLabel>
        </Section>

        <Section title="FillableBox">
          <div style={{ maxWidth: 300 }}>
            <FillableBox
              label="Ripple name"
              placeholder="e.g. Puddles"
              description="You can change this later."
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
        </Section>

        <Section title="Checkbox (bare · labelled row)">
          <Checkbox checked={checked} onChange={e => setChecked(e.target.checked)} />
          <Checkbox checked={checked} onChange={e => setChecked(e.target.checked)}>
            I agree to the Terms of Use
          </Checkbox>
        </Section>

        <Section title="NavigationIcon (close · back)">
          <NavigationIcon variant="close" onClick={() => {}} />
          <NavigationIcon variant="back" onClick={() => {}} />
        </Section>

        <Section title="OnboardingNavigation (both · only-next gated · only-prev)">
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <OnboardingNavigation onPrevious={() => {}} onNext={() => {}} />
            <OnboardingNavigation onNext={() => {}} nextDisabled nextLabel="Agree &amp; continue" />
            <OnboardingNavigation onPrevious={() => {}} />
          </div>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section style={S.section}>
      <p style={S.label}>{title}</p>
      <div style={S.row}>{children}</div>
    </section>
  )
}

const S = {
  page: { maxWidth: 900, margin: '0 auto', padding: '32px 24px 80px' },
  h1: { fontFamily: '"DM Serif Display", Georgia, serif', fontWeight: 400, fontSize: 28, color: 'var(--tx)', marginBottom: 28 },
  section: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: 20, marginBottom: 16 },
  label: { fontFamily: '"Space Mono", monospace', fontSize: 12, color: 'var(--tx2)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 14px' },
  row: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  onPink: { background: 'var(--pk)', padding: 10, borderRadius: 12, display: 'inline-flex' },
}
