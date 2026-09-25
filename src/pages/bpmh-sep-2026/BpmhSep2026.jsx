// Buddhism, Psychology & Mental Health · guest lecture · September 2026.
// "Two Ways of Being a Self": a two-hour interactive lecture for upper-year
// undergraduates. Same shell as /adobe-aug-2026 (click / → / Space advance,
// ← back, N speaker notes, Minimal / Reading density). Interactive pieces
// need no login and write nothing: whole-room exercises on the projector
// (BreathCheck, ToggleRoom, ForageRoom, BreakTimer) and phone activities by QR
// (/prototypes/toggle.html plus the real games at /try/delve, /try/kite,
// /try/face-read, which run logged-out and record nothing).
// Speaker notes carry the timings for the two-hour run. Figures are reused from
// the CUNY deck's rendered slides in public/cuny-2026/.
import { useState, useEffect, useCallback } from 'react'
import { BreathCheck } from '../adobe-aug-2026/exercises'
import { ToggleRoom, BreakTimer, QrPanel, ForageRoom } from './exercises'

export default function BpmhSep2026() {
  const [i, setI] = useState(0)
  const [density, setDensity] = useState(() => {
    try { return localStorage.getItem('bpmhDensity') || 'minimal' } catch { return 'minimal' }
  })
  const [showNotes, setShowNotes] = useState(false)

  const total = SLIDES.length
  const go = useCallback((d) => setI(v => Math.min(total - 1, Math.max(0, v + d))), [total])
  const setDens = useCallback((d) => {
    setDensity(d)
    try { localStorage.setItem('bpmhDensity', d) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    function onKey(e) {
      // An exercise mid-flight owns the keyboard (Enter drives it).
      if (document.body.dataset.exerciseActive) return
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); go(1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp')                { e.preventDefault(); go(-1) }
      else if (e.key === 'n' || e.key === 'N')                             { setShowNotes(s => !s) }
      else if (e.key === 'Home')                                          { setI(0) }
      else if (e.key === 'End')                                           { setI(total - 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, total])

  const slide = SLIDES[i]

  return (
    <div style={K.stage} data-bpmh onClick={() => { if (!slide.exercise) go(1) }}>
      <div style={K.controls} onClick={e => e.stopPropagation()}>
        <div style={K.toggle}>
          {['minimal', 'reading'].map(d => (
            <button key={d} onClick={() => setDens(d)} style={{ ...K.toggleBtn, ...(density === d ? K.toggleOn : {}) }}>
              {d === 'minimal' ? 'Minimal' : 'Reading'}
            </button>
          ))}
        </div>
        <button onClick={() => setShowNotes(s => !s)} style={{ ...K.notesBtn, ...(showNotes ? K.toggleOn : {}) }} title="Speaker notes (N)">
          Notes
        </button>
      </div>

      <div style={K.slideArea}>{slide.render(density)}</div>

      <div style={K.bottom} onClick={e => e.stopPropagation()}>
        <button onClick={() => go(-1)} style={{ ...K.navArrow, visibility: i === 0 ? 'hidden' : 'visible' }} aria-label="Previous">‹</button>
        <span style={K.counter}>{i + 1} / {total}</span>
        <button onClick={() => go(1)} style={{ ...K.navArrow, visibility: i === total - 1 ? 'hidden' : 'visible' }} aria-label="Next">›</button>
      </div>

      {i === 0 && <div style={K.clickHint}>click anywhere to advance · N for notes</div>}

      {showNotes && slide.note && (
        <div style={K.noteOverlay} onClick={e => e.stopPropagation()}>
          <span style={K.noteLabel}>Speaker note{slide.time ? ` · ${slide.time}` : ''}</span>
          <div style={K.noteBody}>{slide.note}</div>
        </div>
      )}
    </div>
  )
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function Frame({ kicker, children, wide }) {
  return (
    <div style={{ ...K.frame, ...(wide ? K.frameWide : {}) }}>
      {kicker && <div style={K.kicker}>{kicker}</div>}
      {children}
    </div>
  )
}
const H2   = ({ children }) => <h2 style={K.h2}>{children}</h2>
const Lead = ({ children }) => <p style={K.lead}>{children}</p>
function Bullets({ items }) {
  return <ul style={K.ul}>{items.map((t, i) => <li key={i} style={K.li}>{t}</li>)}</ul>
}
function Detail({ density, children }) {
  if (density !== 'reading') return null
  return <p style={K.detail}>{children}</p>
}
function Cite({ children }) {
  return <p style={K.cite}>{children}</p>
}
// A quoted passage from the Pali canon, with its reference.
function Sutta({ children, source }) {
  return (
    <div style={K.sutta}>
      <p style={K.suttaText}>“{children}”</p>
      <p style={K.cite}>{source}</p>
    </div>
  )
}
// A discussion prompt card: who talks, for how long, about what.
function Talk({ who, mins, items }) {
  return (
    <div style={K.talk}>
      <div style={K.talkHead}>{who} · {mins} min</div>
      <ul style={{ ...K.ul, gap: 8 }}>{items.map((t, i) => <li key={i} style={K.li}>{t}</li>)}</ul>
    </div>
  )
}

// A figure lifted from another deck's rendered slides (e.g. /cuny-2026/).
function Fig({ src, alt, h = '50vh', caption }) {
  return (
    <figure style={K.fig}>
      <img src={src} alt={alt || ''} style={{ ...K.figImg, maxHeight: h }} />
      {caption && <figcaption style={K.cite}>{caption}</figcaption>}
    </figure>
  )
}

const STORY = '#4A90D9'
const SENSE = '#f068a4'

// Two modes of self-reference, with the Buddhist and clinical vocabularies
// that map onto each. The deck's recurring picture.
function TwoModes({ rows }) {
  const box = (title, sub, tone, items) => (
    <div style={{ ...K.mode, borderColor: `${tone}66` }}>
      <div style={{ ...K.modeTitle, color: tone }}>{title}</div>
      <div style={K.modeSub}>{sub}</div>
      <ul style={{ ...K.ul, gap: 6 }}>
        {items.map((t, i) => <li key={i} style={{ ...K.li, fontSize: 'clamp(13px,1.6vw,18px)' }}>{t}</li>)}
      </ul>
    </div>
  )
  return (
    <div style={K.modes}>
      {box('Story', rows?.storySub || 'narrative self-focus', STORY, rows?.story || [
        'the self as a character extended in time',
        'evaluates: good, bad, me, mine',
        'midline cortex (mPFC, PCC)',
      ])}
      <div style={K.modeArrow}>⇄</div>
      {box('Sense', rows?.senseSub || 'experiential self-focus', SENSE, rows?.sense || [
        'the self as this moment of experience',
        'registers: warm, pressure, sound, change',
        'insula, somatosensory and lateral prefrontal cortex',
      ])}
    </div>
  )
}

// Contact → feeling → perception → thought → proliferation (MN 18).
function Chain() {
  const steps = [
    ['Contact', 'sense meets object', SENSE],
    ['Feeling', 'vedanā: tone', SENSE],
    ['Perception', 'saññā: “that is a…”', '#9a7fc0'],
    ['Thinking', 'vitakka: about it', STORY],
    ['Proliferation', 'papañca: me, mine', STORY],
  ]
  return (
    <div style={K.chain}>
      {steps.map(([t, s, c], k) => (
        <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ ...K.chainStep, borderColor: `${c}66` }}>
            <div style={{ ...K.modeTitle, color: c, fontSize: 'clamp(16px,2vw,22px)' }}>{t}</div>
            <div style={K.modeSub}>{s}</div>
          </div>
          {k < steps.length - 1 && <span style={{ ...K.modeArrow, fontSize: 24 }}>→</span>}
        </div>
      ))}
    </div>
  )
}

// Stress → sensory inhibition → the story wins.
function Brake() {
  const step = (t, sub, tone) => (
    <div style={{ ...K.brakeStep, borderColor: `${tone}66` }}>
      <div style={{ ...K.modeTitle, color: tone, fontSize: 18 }}>{t}</div>
      <div style={K.modeSub}>{sub}</div>
    </div>
  )
  return (
    <div style={K.brake}>
      {step('Sad or stressed mood', 'a loss, a mistake, a low day', '#c04a82')}
      <span style={K.modeArrow}>→</span>
      {step('Brake on sensing', 'insula and somatosensory cortex go quiet', STORY)}
      <span style={K.modeArrow}>→</span>
      {step('The story fills in', 'rumination: no fresh signal to update it', '#6b6c70')}
    </div>
  )
}

// ── Slides ──────────────────────────────────────────────────────────────────
// Running times in `time` are cumulative targets for a 2-hour slot.

const SLIDES = [
  // 1 — Title
  {
    time: '0:00',
    render: () => (
      <Frame wide>
        <div style={K.crests}>
          <img src="/RADlab_Logo_light.svg" alt="RADlab" style={{ height: 48 }} onError={e => { e.currentTarget.style.display = 'none' }} />
          <img src="/UofT_Logo.svg" alt="University of Toronto" style={{ height: 48 }} onError={e => { e.currentTarget.style.display = 'none' }} />
        </div>
        <h1 style={K.title}>Two Ways of Being a Self</h1>
        <p style={K.subtitle}>narrative, sensation, and the practice of sense foraging</p>
        <div style={{ height: 8 }} />
        <p style={K.author}>Norman Farb, PhD</p>
        <p style={K.affil}>Regulatory & Affective Dynamics Lab · Psychology · University of Toronto Mississauga</p>
        <p style={K.event}>Buddhism, Psychology & Mental Health · September 2026</p>
      </Frame>
    ),
    note: 'Welcome. Keep phones out today: they are part of the lecture. Everything we use opens from a QR code, needs no account, and saves nothing. The through-line: Buddhist psychology and affective neuroscience both describe two ways of being a self, a story and a moment of sensing. Mental health depends less on which one you are in than on whether you can move between them.',
  },

  // 2 — Today
  {
    time: '0:02',
    note: 'Walk the arc quickly. Three blocks of roughly 30 minutes with a break in the middle. Each block has something to do, not just something to hear. Set the norm: no one will be asked to share anything personal out loud; pair talk is about what you noticed, not what you feel about your life.',
    render: () => (
      <Frame wide kicker="Today · 2 hours">
        <H2>Notice, name, practise</H2>
        <div style={K.agenda}>
          {[
            ['0:00', 'Opener', 'Breath check: is the sensing channel on?'],
            ['0:11', 'Two modes of self', 'Papañca, the second arrow, and the brain’s two self-networks'],
            ['0:27', 'Toggle', 'Switching modes on purpose: as a room, on your phone, with your hands'],
            ['0:48', 'Break', '10 minutes'],
            ['0:58', 'When the story takes over', 'Sensory shutdown, relapse, decentering, and the longer path'],
            ['1:21', 'Sense foraging', 'Foraging together, then three RADlab games on your phone'],
            ['1:46', 'Balance', 'Too far either way, three pitfalls, a practice check, radlab.zone'],
          ].map(([t, h, s]) => (
            <div key={t} style={{ ...K.agendaRow, ...(h === 'Break' ? { opacity: 0.6 } : {}) }}>
              <span style={K.agendaT}>{t}</span>
              <span style={K.agendaH}>{h}</span>
              <span style={K.agendaS}>{s}</span>
            </div>
          ))}
        </div>
        <Cite>phones welcome · no logins · nothing is recorded</Cite>
      </Frame>
    ),
  },

  // 3 — EXERCISE: breath check
  {
    time: '0:04',
    exercise: true,
    note: 'Whole-room exercise, about 40 seconds. Everyone breathes with the circle for four breaths; after two, the pace changes (or does not) at random. Show of hands: faster, slower, same. Then reveal. Enter starts; Enter reveals; Space moves on. Do it twice if the room is split: the second run is usually more confident, which is itself a point about attention.',
    render: () => (
      <Frame wide kicker="Exercise · 4 breaths">
        <BreathCheck />
      </Frame>
    ),
  },

  // 4 — Debrief: interoception
  {
    time: '0:08',
    note: 'Ask: how did you decide? Take three or four answers. Typical: “I counted”, “I just felt it”, “I guessed”. Counting is the narrative brain modelling the breath; feeling it is interoception. Define interoception broadly: sensing the state of the body from inside. It is the raw material of feeling tone. Then set up the Buddhist framing: the tradition has a detailed map of what happens between a sensation and a story.',
    render: (d) => (
      <Frame kicker="Debrief">
        <H2>How did you decide?</H2>
        <div style={K.twoCol}>
          <div style={K.col}>
            <div style={K.colHead(STORY)}>“I counted”</div>
            <Bullets items={['A model of the breath, built in thought.', 'Accurate, but one step removed.']} />
          </div>
          <div style={K.col}>
            <div style={K.colHead(SENSE)}>“I felt it”</div>
            <Bullets items={['Interoception: sensing the body from the inside.', 'Direct, but easy to lose.']} />
          </div>
        </div>
        <Lead>Most of us reach for the story first, even when the sensation is right there.</Lead>
        <Detail density={d}>
          Interoception covers breath, heartbeat, gut, temperature, and the felt tone of emotion. In Buddhist
          psychology its closest neighbour is vedanā, the pleasant, unpleasant or neutral tone that comes with every
          contact. Both traditions treat it as the hinge between what happens and what we make of it.
        </Detail>
      </Frame>
    ),
  },

  // 5 — Section: two modes
  {
    time: '0:11',
    note: 'Section break. Part 1: two modes of self. We start with the canon, then look at what the brain seems to be doing.',
    render: () => (
      <Frame>
        <div style={K.kicker}>Part 1</div>
        <h1 style={K.title}>Two modes of self</h1>
        <Lead>What the tradition mapped, and what the brain seems to be doing.</Lead>
      </Frame>
    ),
  },

  // 6 — Papañca (MN 18)
  {
    time: '0:12',
    note: 'The Madhupiṇḍika Sutta (MN 18) gives the sequence: eye and form meet, consciousness arises, the meeting of the three is contact; with contact there is feeling; what one feels one perceives; what one perceives one thinks about; what one thinks about one proliferates. Papañca is that proliferation: the self-referential elaboration that turns a sensation into a story about me. The key psychological claim: the early links are brief and relatively neutral; suffering builds in the later ones. Ask the room where in the chain they think rumination lives.',
    render: (d) => (
      <Frame wide kicker="Buddhist psychology · MN 18">
        <H2>From contact to proliferation</H2>
        <Chain />
        <Sutta source="Madhupiṇḍika Sutta, MN 18 (trans. Ñāṇamoli & Bodhi)">
          What one feels, one perceives. What one perceives, one thinks about. What one thinks about, one mentally proliferates.
        </Sutta>
        <Detail density={d}>
          Papañca (conceptual proliferation) is the tradition’s account of how a moment of contact becomes a
          self-referential narrative. The early links are fast and close to the senses; the elaboration that follows is
          where the tradition locates most suffering, and where modern clinicians would locate rumination.
        </Detail>
      </Frame>
    ),
  },

  // 7 — The second arrow (SN 36.6)
  {
    time: '0:16',
    note: 'The Sallatha Sutta (SN 36.6): the untrained person, struck by a painful feeling, sorrows and laments, and so feels two pains, as if shot by an arrow and then a second arrow. The trained person feels the first arrow only. Stress the claim is not that pain goes away: the first arrow still lands. What changes is the second arrow, the reaction built on top. Invite one example from the room of a “second arrow” (keep it light: an exam mark, a text left on read).',
    render: (d) => (
      <Frame kicker="Buddhist psychology · SN 36.6">
        <H2>The first arrow and the second</H2>
        <div style={K.twoCol}>
          <div style={K.col}>
            <div style={K.colHead(SENSE)}>First arrow</div>
            <Bullets items={['The painful feeling itself.', 'Contact and vedanā. It lands for everyone.']} />
          </div>
          <div style={K.col}>
            <div style={K.colHead(STORY)}>Second arrow</div>
            <Bullets items={['What we add: why me, what this means, what comes next.', 'Optional, and usually longer-lasting.']} />
          </div>
        </div>
        <Sutta source="Sallatha Sutta, SN 36.6 (paraphrase)">
          Struck by a painful feeling, the untrained person sorrows and laments, and feels two pains, bodily and mental, as if shot with an arrow and then a second.
        </Sutta>
        <Detail density={d}>
          The trained practitioner still feels the first arrow. The claim is not anaesthesia; it is that the
          elaboration, not the sensation, carries most of the suffering. This is the same distinction clinicians draw
          between pain and distress about pain.
        </Detail>
      </Frame>
    ),
  },

  // 8 — Two modes in the brain (Farb 2007)
  {
    time: '0:20',
    note: 'Our 2007 study (figure from the CUNY deck, “Modes of Reference”). Participants read trait adjectives and either reflected on what the word said about them (narrative focus) or attended to their moment-to-moment experience while reading (experiential focus). Narrative focus: midline cortex, the “prior knowledge” network. Experiential focus: lateral regions, insula, S2/IPL and LPFC, the “current sensation” network. Comparison was cross-sectional: MBSR-trained vs novices. VERIFY before saying the decoupling line: the trained group showed the lateral shift and less midline-insula coupling. Link back: the story mode looks like papañca; the sense mode looks like staying nearer to contact and feeling.',
    render: (d) => (
      <Frame wide kicker="Neuroscience">
        <H2>Two self-networks, one brain</H2>
        <Fig src="/cuny-2026/s23_2.webp" alt="Modes of Reference: midline prior-knowledge network vs lateral current-sensation network" h="48vh" />
        <div style={K.pills}>
          <span style={K.pill(STORY)}>Story: prior knowledge · PCC, dmPFC</span>
          <span style={K.pill(SENSE)}>Sense: current sensation · insula, S2, LPFC</span>
        </div>
        <Detail density={d}>
          Farb et al., SCAN 2007: narrative self-focus on trait adjectives engaged medial prefrontal cortex;
          experiential focus recruited insula, secondary somatosensory and lateral prefrontal cortex, more so in
          participants trained in mindfulness (MBSR) than in novices.
        </Detail>
        <Cite>Farb et al., Soc Cog Affect Neurosci (2007)</Cite>
      </Frame>
    ),
  },

  // 9 — Anattā, carefully
  {
    time: '0:24',
    note: 'Careful framing. Anattā (SN 22.59) is a claim that none of the five aggregates, including feeling and perception, is a lasting self. It is not a claim that people do not exist. One psychological reading: the narrative self is a construction, rebuilt moment to moment (Dennett’s “center of narrative gravity”), and the experiential mode lets you watch it being built. Push back on the easy mapping: the insula is not “no-self”, and experiential focus still has a subject. Ask the room, show of hands or one or two voices: is the narrative self a problem, or a tool?',
    render: (d) => (
      <Frame kicker="A careful bridge">
        <H2>Anattā as a psychological hypothesis?</H2>
        <Bullets items={[
          'The claim (SN 22.59): none of the aggregates, form, feeling, perception, formations, consciousness, is a lasting self.',
          'A psychological reading: the narrative self is built moment to moment, and can be watched being built.',
          'Where the mapping breaks: experiential focus still has a subject. The insula is not “no-self”.',
        ]} />
        <Lead>Is the story-self a problem, or a tool? When is it each?</Lead>
        <Detail density={d}>
          Anattalakkhaṇa Sutta, SN 22.59. Treat neuroscience as a lens, not a verdict: brain data can show what
          changes when attention shifts, not whether a metaphysical self exists.
        </Detail>
      </Frame>
    ),
  },

  // 10 — Section: Toggle
  {
    time: '0:27',
    note: 'Section break into the exercise block. Frame: if the two modes are real, you should be able to feel yourself switch. We will do it guided first, then on your own.',
    render: () => (
      <Frame>
        <div style={K.kicker}>Exercise block</div>
        <h1 style={K.title}>Toggle</h1>
        <Lead>If there are two modes, you should be able to feel yourself switch between them. First as a room, guided. Then alone, on your phone.</Lead>
      </Frame>
    ),
  },

  // 11 — EXERCISE: ToggleRoom
  {
    time: '0:28',
    exercise: true,
    note: 'About 4 minutes with 30 s blocks (pick 20 s for a restless room, 45 s for a settled one). Six blocks alternate Sense and Story, each with a tone. Keep your own voice out of it once it starts; the screen cues. Then three show-of-hands questions. Expect: Story is easy, Sense is slippery, stories creep into Sense blocks. That is the Farb 2007 coupling, felt from the inside.',
    render: () => (
      <Frame wide kicker="Exercise · Toggle, guided">
        <ToggleRoom />
      </Frame>
    ),
  },

  // 12 — Phone: Toggle, unguided
  {
    time: '0:33',
    note: 'Solo, 3 minutes by default (the phone lets them choose). Now nothing cues them: they pick a sensory anchor and tap Story whenever they notice they have drifted into thinking, Sense when they land back. At the end they see their own timeline. Nothing is sent anywhere. Give it 30 s to get everyone loaded, then quiet for 3 minutes. Then the pair questions appear on their phone.',
    render: () => (
      <Frame wide kicker="On your phone · 5 min">
        <H2>Toggle, on your own</H2>
        <div style={K.qrRow}>
          <QrPanel path="/prototypes/toggle.html" label="Toggle" size={230} />
          <div style={{ ...K.col, maxWidth: 520 }}>
            <Bullets items={[
              'Pick a sense to rest with: breath, sound, body weight, or hands.',
              'Tap Story each time you notice you are thinking.',
              'Tap Sense when you land back in sensation.',
              'At the end: your own timeline. It never leaves your phone.',
            ]} />
          </div>
        </div>
      </Frame>
    ),
  },

  // 13 — Debrief Toggle
  {
    time: '0:38',
    note: 'Pairs 3 minutes, then take four or five answers. Pull out: (1) what pulled them into Story (plans, judgements about how they were doing, the exercise itself); (2) whether tapping Story felt like failure or noticing. The second is the important clinical point: the moment of noticing is decentering in miniature, the thought seen as a thought. Killingsworth & Gilbert: people report mind-wandering in almost half of sampled moments, and report lower mood when wandering, even to pleasant topics.',
    render: (d) => (
      <Frame wide kicker="Debrief">
        <H2>The catch is the practice</H2>
        <Talk who="Pairs" mins={3} items={[
          'What pulled you back into Story?',
          'Did tapping Story feel like failing, or like noticing?',
          'Was Sense empty, or did it have a texture of its own?',
        ]} />
        <Lead>Every tap on Story was a thought seen as a thought. Clinicians call that decentering.</Lead>
        <Detail density={d}>
          Killingsworth & Gilbert, Science 2010: in experience sampling, minds wandered in about 47% of moments, and
          people were less happy when wandering than when not, including when wandering to pleasant topics.
        </Detail>
        <Cite>Killingsworth & Gilbert, Science (2010)</Cite>
      </Frame>
    ),
  },

  // 13b — Toggling for balance (from SenseForaging 2023)
  {
    time: '0:43',
    note: 'Adapted from the 2023 sense-foraging workshop (“Toggling for Balance”, “Novices sense, experts toggle”). About 4 minutes. Everyone in their seat. Fists: tighten, and notice what the story says (judging, bracing, “I should…”). Open palms: let air and weight arrive. Toggle three or four times at your own pace. Then the reflection question, answered privately or with a neighbour. The point: the skill is not staying open, it is moving between closed and open on purpose.',
    render: () => (
      <Frame wide kicker="Exercise · Toggling for balance">
        <H2>Novices sense. Experts toggle.</H2>
        <div style={K.steps}>
          {[
            ['1', 'Close', 'Make two fists. Tighten. What is the story saying right now?'],
            ['2', 'Open', 'Palms up, let go. Air, weight, warmth, tingling. What is here?'],
            ['3', 'Toggle', 'Close, open, close, open. Your own pace. Notice the switch itself.'],
          ].map(([n, t, s]) => (
            <div key={n} style={K.step}>
              <div style={K.stepN}>{n}</div>
              <div style={K.stepT}>{t}</div>
              <div style={K.stepS}>{s}</div>
            </div>
          ))}
        </div>
        <Talk who="Alone or with a neighbour" mins={2} items={[
          'Where in your life are you more closed to change than you would like?',
          'Where are you more open than is good for you?',
        ]} />
      </Frame>
    ),
  },

  // 14 — Break
  {
    time: '0:48',
    exercise: true,
    note: 'Ten minutes. Enter starts the countdown; a tone sounds at zero. Suggest they try the Toggle page once more over the break, or just notice what their attention does with free time.',
    render: () => (
      <Frame wide kicker="Break">
        <H2>Back in ten</H2>
        <BreakTimer minutes={10} />
        <Lead>Optional: notice where your attention goes when nothing is asking for it.</Lead>
      </Frame>
    ),
  },

  // 15 — Section: when the story takes over
  {
    time: '0:58',
    note: 'Part 2, the mental health block. Why the ability to switch matters clinically.',
    render: () => (
      <Frame>
        <div style={K.kicker}>Part 2</div>
        <h1 style={K.title}>When the story takes over</h1>
        <Lead>Stress, rumination, and why the ability to switch is protective.</Lead>
      </Frame>
    ),
  },

  // 16 — The brake on sensing (Emotion 2010, figure from CUNY)
  {
    time: '0:59',
    note: 'The film-clip study (figure from the CUNY deck). Sad clips (The Champ, Terms of Endearment) vs neutral HGTV clips. Sample: community “worried well” (BDI 10–20), MBSR completers (n = 20) vs waitlist (n = 16); not a patient sample. Sadness raised midline default-mode activity in everyone, and that rise was unrelated to depression. What tracked depression was the other side: insula, S1/S2 and LPFC shut down, r = −.47 with BDI. The MBSR group did not inhibit sensation to the same degree. From the chapter draft: sadness had become “a type of expectation, concept, or thing, rather than a living, embodied experience.” That is rumination: papañca without new contact.',
    render: (d) => (
      <Frame wide kicker="Affective neuroscience">
        <H2>Low mood puts a brake on sensing</H2>
        <Brake />
        <Fig src="/cuny-2026/s15_2.webp" alt="Sadness leads to sensory inhibition; insula reactivity vs depression" h="40vh" />
        <Lead>The story rose in everyone. What tracked depression was sensation switching off (r = −.47).</Lead>
        <Detail density={d}>
          Farb et al., Emotion 2010 (N = 36; MBSR n = 20, waitlist n = 16; BDI 10–20): sad vs neutral film clips raised
          mPFC/PCC and reduced insula, S1/S2 and LPFC. Insula reactivity correlated with depression, r = −.47. MBSR
          participants showed less sensory inhibition.
        </Detail>
        <Cite>Farb et al., Emotion (2010)</Cite>
      </Frame>
    ),
  },

  // 16b — Inhibition predicts relapse (Neuroimage: Clinical 2022, figure from CUNY)
  {
    time: '1:03',
    note: 'Same film-clip challenge, now in 85 people recently recovered from depression, scanned before and after 8 weeks of MBCT or CT, then followed for 2 years. Somatosensory inhibition scaled with past episodes and residual symptoms, and predicted who relapsed. Median split: 16 of 43 below-median relapsed vs 2 of 42 above-median. Hazard ratio in the 2017–19 talks: 5.97 [2.3–15.3]. The classification numbers (88% accuracy) are within-sample only, so do not present them as a clinical test.',
    render: (d) => (
      <Frame wide kicker="Clinical neuroscience">
        <H2>Switching sensation off predicts relapse</H2>
        <Fig src="/cuny-2026/s18_3.webp" alt="Somatosensory inhibition predicts relapse; survival curves by reactivity" h="50vh" />
        <Lead>Of those with the most sensory shutdown, 16 of 43 relapsed within two years. Of the rest, 2 of 42.</Lead>
        <Detail density={d}>
          Farb et al., Neuroimage: Clinical 2022: N = 85 recently remitted adults × 2 scans (pre/post MBCT or CT-WF).
          Greater somatosensory inhibition to sad clips predicted time to relapse (hazard ≈ 6×). Within-sample only.
        </Detail>
        <Cite>Farb et al., Neuroimage: Clinical (2022)</Cite>
      </Frame>
    ),
  },

  // 17 — Doing and being (MBCT)
  {
    time: '1:06',
    note: 'MBCT (Segal, Williams & Teasdale, 2002) built its model on exactly this contrast: a “doing” mode that works on the gap between how things are and how they should be (useful for tasks, disastrous when applied to mood), and a “being” mode that allows experience to be as it is. Note the same two-mode structure appears three times now: papañca vs contact, narrative vs experiential, doing vs being. Ask: are these the same distinction? What is lost in treating them as one?',
    render: (d) => (
      <Frame wide kicker="Clinical translation · MBCT">
        <H2>Three vocabularies, one shape?</H2>
        <div style={K.table}>
          {[
            ['', 'Story', 'Sense'],
            ['Pali canon', 'papañca, the second arrow', 'contact, vedanā, the first arrow'],
            ['Neuroscience', 'narrative self-focus (midline)', 'experiential focus (insula)'],
            ['MBCT', 'doing mode', 'being mode'],
          ].map((r, k) => (
            <div key={k} style={{ ...K.tr, ...(k === 0 ? K.th : {}) }}>
              {r.map((c, j) => (
                <span key={j} style={{ ...K.td, ...(j === 0 ? K.tdHead : {}), ...(k === 0 && j === 1 ? { color: STORY } : {}), ...(k === 0 && j === 2 ? { color: SENSE } : {}) }}>{c}</span>
              ))}
            </div>
          ))}
        </div>
        <Lead>Are these the same distinction? What gets lost if we treat them as one?</Lead>
        <Detail density={d}>
          Segal, Williams & Teasdale (2002/2013): MBCT’s doing mode monitors the gap between current and desired
          states, which helps with tasks but deepens low mood when turned on the self. Being mode allows experience
          without needing to fix it.
        </Detail>
      </Frame>
    ),
  },

  // 18 — Decentering and relapse (Segal 2019, figures from CUNY)
  {
    time: '1:09',
    note: 'Full RCT, N = 156, MBCT vs cognitive therapy with a wellbeing focus (CT-WF). Key correction to the usual story: both arms protected about equally (relapse about 22% vs 21%). Decentering grew in both, so it is a shared mechanism, not an MBCT-only one. People with high decentering growth stayed well more often (about 80% vs 63% relapse-free at 2 years). Practice: course practice predicted follow-up practice (.31), follow-up practice predicted decentering (.42), decentering predicted less relapse (−.22); practice had no direct path to relapse (.02). Practice works through the skill. Link to Toggle: every tap on Story is one rep.',
    render: (d) => (
      <Frame wide kicker="Evidence">
        <H2>Decentering: seeing a thought as an event</H2>
        <div style={K.figRow}>
          <Fig src="/cuny-2026/s35_0.webp" alt="Decentering growth is protective: survival curves" h="36vh" />
          <Fig src="/cuny-2026/s36_3.webp" alt="Practice predicts decentering, decentering predicts relapse" h="36vh" />
        </div>
        <Bullets items={[
          'MBCT and cognitive therapy protected about equally. Decentering grew in both.',
          'Practice after the course built decentering; decentering, not practice itself, predicted staying well.',
        ]} />
        <Detail density={d}>
          Segal et al., JCCP 2019; Farb et al., JCCP 2018 (N = 156). MBCT vs CT-WF relapse ≈ 22% vs 21%. Path:
          course practice → follow-up practice .31; follow-up practice → decentering .42; decentering → relapse −.22;
          practice → relapse .02 (n.s.). For MBCT vs usual care, see the individual-patient meta-analysis (Kuyken et
          al., JAMA Psychiatry 2016).
        </Detail>
        <Cite>Segal et al., JCCP 2019 · Kuyken et al., JAMA Psychiatry 2016</Cite>
      </Frame>
    ),
  },

  // 18b — The Visuddhimagga progression as decentering (from BuddhistStudies 2019)
  {
    time: '1:13',
    note: 'From the 2019 Buddhist Studies talk. The insight stages as Mahasi Sayadaw teaches them from the Visuddhimagga, read as a trajectory that decentering research only captures the first steps of. Sensory attention, then labelling what arises, then awareness of the labelling, then insight into change, then deep insight. Clinical programmes mostly stop at step 2 or 3. Ask: is that a problem, or a feature, for a clinical intervention?',
    render: (d) => (
      <Frame wide kicker="Buddhist psychology · a trajectory">
        <H2>Where clinical decentering sits on a longer path</H2>
        <div style={K.chain}>
          {[
            ['Sensory attention', 'the breath, the body', SENSE],
            ['Mental labelling', '“thinking”, “hearing”', SENSE],
            ['Meta-awareness', 'knowing that you know', '#9a7fc0'],
            ['Insight into change', 'everything arises and passes', STORY],
            ['Deep insight', 'the tradition’s goal', STORY],
          ].map(([t, sub, c], k, arr) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ ...K.chainStep, borderColor: `${c}66` }}>
                <div style={{ ...K.modeTitle, color: c, fontSize: 'clamp(15px,1.9vw,21px)' }}>{t}</div>
                <div style={K.modeSub}>{sub}</div>
              </div>
              {k < arr.length - 1 && <span style={{ ...K.modeArrow, fontSize: 24 }}>→</span>}
            </div>
          ))}
        </div>
        <Lead>MBCT trains the first steps. Is stopping there a problem, or the point?</Lead>
        <Detail density={d}>
          Buddhaghosa, Visuddhimagga (c. 430 CE); stages as presented by Mahasi Sayadaw (2006). A lens for reading
          decentering as the opening of a longer contemplative trajectory, not a claim that the two are the same.
        </Detail>
        <Cite>Visuddhimagga · Mahasi Sayadaw (2006)</Cite>
      </Frame>
    ),
  },

  // 19 — Is mindfulness Buddhist? (discussion)
  {
    time: '1:16',
    note: 'Discussion, 4 minutes in small groups. This is the program’s home question, so let them run with it. Points to surface if they do not: sati in the canon is closer to “remembering” or keeping something in mind (Bodhi 2011) than to “non-judgemental awareness”; clinical mindfulness drops ethics and the goal of liberation; the McMindfulness critique (Purser 2019) says it can adapt people to harmful conditions instead of changing them. Counterpoint: MBCT never claimed to be Buddhism; it claims a transferable attentional skill.',
    render: (d) => (
      <Frame wide kicker="Discussion">
        <H2>Is clinical mindfulness still Buddhist?</H2>
        <Talk who="Groups of 3–4" mins={4} items={[
          'Sati in the canon means something like “keeping in mind”. Is “non-judgemental awareness” a fair translation?',
          'What is lost when the practice leaves its ethical frame? Is anything gained?',
          'Does a sensory skill need a worldview to work?',
        ]} />
        <Detail density={d}>
          Bodhi, Contemporary Buddhism 2011, on sati as retention and recollection. Purser, McMindfulness (2019), on
          mindfulness as adaptation to stress rather than challenge to its causes.
        </Detail>
        <Cite>Bodhi 2011 · Purser 2019</Cite>
      </Frame>
    ),
  },

  // 20 — Section: sense foraging
  {
    time: '1:21',
    note: 'Part 3. From noticing the story to feeding the senses on purpose.',
    render: () => (
      <Frame>
        <div style={K.kicker}>Part 3</div>
        <h1 style={K.title}>Sense foraging</h1>
        <Lead>Not escaping the story. Feeding it something new.</Lead>
      </Frame>
    ),
  },

  // 20b — Sensation as an agent of change (figure from CUNY)
  {
    time: '1:22',
    note: 'From the CUNY deck. Prediction framing: the story supplies priors (“hopeless”, “worthless”); sensation supplies current evidence (“I feel OK at the moment”). When the two disagree, that surprise is what motivates updating. Rumination wins when sensation is switched off, because the priors never meet any disagreement. The Satipaṭṭhāna Sutta instruction is, read this way, interoceptive training: report the breath as it is, not as expected.',
    render: (d) => (
      <Frame wide kicker="Buddhist psychology meets prediction">
        <H2>Sensation as an agent of change</H2>
        <Fig src="/cuny-2026/s21_3.webp" alt="Prior knowledge vs current sensation; surprise drives regulation" h="46vh" />
        <Sutta source="Satipaṭṭhāna Sutta, MN 10">If the breath is long, notice that the breath is long. If the breath is short, notice that the breath is short.</Sutta>
        <Detail density={d}>
          The breath instruction asks for a report of what is, not what is expected. When current sensation disagrees
          with a prior like “hopeless”, the surprise is the signal the story has to update around.
        </Detail>
      </Frame>
    ),
  },

  // 21 — What is sense foraging
  {
    time: '1:25',
    note: 'Definition: purposely shifting attention from thinking to sensing, with receptivity and a willingness to be surprised. Three steps. The second check-in is the whole point: it is the moment the sensing channel gets to report a change, and the story has to update around it. Contrast with relaxation: relaxation turns the volume down; foraging keeps a channel open. Link to the Bāhiya teaching (Ud 1.10): “in the seen, only the seen”.',
    render: (d) => (
      <Frame wide kicker="The practice">
        <H2>Check in. Forage. Check back.</H2>
        <Lead>Purposely shifting attention from thinking to sensing, with receptivity to the sensory world and a willingness to be surprised.</Lead>
        <div style={K.steps}>
          {[
            ['1', 'Check in', 'What is the state, honestly? A number, a word, a felt sense.'],
            ['2', 'Forage', 'Find one thing to actually sense. Not to relax. To notice.'],
            ['3', 'Check back', 'Did anything shift? The second look is where change gets registered.'],
          ].map(([n, t, s]) => (
            <div key={n} style={K.step}>
              <div style={K.stepN}>{n}</div>
              <div style={K.stepT}>{t}</div>
              <div style={K.stepS}>{s}</div>
            </div>
          ))}
        </div>
        <Sutta source="Bāhiya Sutta, Ud 1.10">In the seen will be merely the seen; in the heard, merely the heard.</Sutta>
        <Detail density={d}>
          Farb & Segal, Better in Every Sense (2024). The design problem our lab works on: practices short enough to
          fit a real day and specific enough to address sensory shutdown.
        </Detail>
      </Frame>
    ),
  },

  // 21b — EXERCISE: forage together (adapted from the Sick Kids keynote demos)
  {
    time: '1:27',
    exercise: true,
    note: 'Adapted from the 2026 Sick Kids keynote’s in-room demos (check in, stimulus, check in again). About 2 minutes, no phones. Check-in: one word for your state, silently. Forage 60 s: the screen rotates prompts through the room’s senses. Check back: one word again. Show of hands: did the word change? Point: sixty seconds of sensing is enough for the sensing channel to report something the story did not predict.',
    render: () => (
      <Frame wide kicker="Exercise · forage together">
        <ForageRoom />
      </Frame>
    ),
  },

  // 22 — Three games, three modes
  {
    time: '1:30',
    note: 'Set up the phone block. These are the lab’s own games from radlab.zone, opened without an account: nothing is saved, and all three run silently. They were chosen to pull in different directions. Delve rewards resting: the haze only clears where attention stays still, and fast scanning reveals nothing (craving, taṇhā, made mechanical). Kite has no pacer: you breathe at your own pace and the face breathes with you, so there is nothing to keep up with. Face Read is the opposite: a judging task, name the feeling and its strength, and it is scored. Ask them to notice which mode each one pulls them into.',
    render: (d) => (
      <Frame wide kicker="Design logic">
        <H2>Three games, three pulls</H2>
        <div style={K.steps}>
          {[
            ['Delve', SENSE, 'Rest your attention and the image clears. Scan fast and nothing comes.', 'Sense · receptive'],
            ['Kite', '#9a7fc0', 'No pacer. Breathe at your own pace; the face breathes with you.', 'Sense · the body'],
            ['Face Read', STORY, 'Name the feeling and how strong it is. Scored.', 'Story · judging'],
          ].map(([t, c, sub, tag]) => (
            <div key={t} style={{ ...K.step, borderColor: `${c}66` }}>
              <div style={{ ...K.stepN, color: c }}>{tag}</div>
              <div style={{ ...K.stepT, color: c }}>{t}</div>
              <div style={K.stepS}>{sub}</div>
            </div>
          ))}
        </div>
        <Lead>As you play, notice which mode each one pulls you into, and what happens when you try harder.</Lead>
        <Detail density={d}>
          All three are live RADlab games, here opened without an account: nothing is recorded, no sound. Delve’s
          reveal only happens below a pointer speed threshold; Kite logs your own breath shape over eight breaths;
          Face Read scores emotion recognition on a valence and arousal wheel.
        </Detail>
      </Frame>
    ),
  },

  // 23 — Phone stations
  {
    time: '1:32',
    note: 'About 10 minutes. Everyone picks one, plays for about 4 minutes, then tries a second. Suggest pairing a Sense game with Face Read so they feel the contrast. Delve: rest a finger in one spot and wait; tap “finish” when done. Kite: hold one button to breathe in, the other to breathe out; eight breaths, then you see your breath shapes. Face Read: 10 faces, tap the wheel. Walk the room; watch for fast swiping in Delve and ask what they notice.',
    render: () => (
      <Frame wide kicker="On your phone · 10 min">
        <H2>Pick one, then try a second.</H2>
        <div style={K.qrRow}>
          <div style={K.station}>
            <QrPanel path="/try/delve" label="Delve" size={200} />
            <p style={K.stationS}>An image waits behind haze. Rest your attention in one place and it comes clear.</p>
          </div>
          <div style={K.station}>
            <QrPanel path="/try/kite" label="Kite" tone="#9a7fc0" size={200} />
            <p style={K.stationS}>Hold to breathe in, hold to breathe out. Eight breaths, eight kites.</p>
          </div>
          <div style={K.station}>
            <QrPanel path="/try/face-read" label="Face Read" tone={STORY} size={200} />
            <p style={K.stationS}>A face moves into an expression. Name the feeling, and how strong it is.</p>
          </div>
        </div>
        <Cite>no login · nothing saved · no sound needed</Cite>
      </Frame>
    ),
  },

  // 24 — Debrief foraging
  {
    time: '1:42',
    note: 'Pairs 3 minutes, then a few answers. Look for the contrast: Delve got worse with effort and better with stillness; Face Read invited judging and often a pull to score well. That pull is the story mode switching on. Kite sits between: some people breathe naturally, others start performing their breath for the face. Ask whether anyone felt a pull to “win” and what that was like.',
    render: () => (
      <Frame wide kicker="Debrief">
        <H2>What happened when you tried harder?</H2>
        <Talk who="Pairs" mins={3} items={[
          'In Delve, did reaching for the image make it slip away?',
          'Did Face Read feel different from the other two? Where did the story show up?',
          'In Kite, were you breathing, or performing your breathing?',
        ]} />
        <Lead>Receptivity is a skill, and like decentering it can be practised.</Lead>
      </Frame>
    ),
  },

  // 24b — What is actually protective? (figure from CUNY)
  {
    time: '1:46',
    note: 'From the CUNY deck. If rumination plus sensory inhibition is the overgrown garden, the fix is not to clear-cut it. Stopping rumination and inhibition can leave a desert: order and structure gone, freedom tipping into disorder and absence of meaning. What protects is the third picture, and it needs both: the story’s structure and the senses’ fresh input. From the CUNY abstract: these techniques “can be taken too far, diving so far into the sensory world that life stops making sense.”',
    render: (d) => (
      <Frame wide kicker="Too far the other way">
        <H2>What is actually protective about sensation?</H2>
        <Fig src="/cuny-2026/s29_3.webp" alt="Rumination and sensory inhibition; cessation; flourishing?" h="46vh" />
        <Lead>Clearing out the story is not the same as flourishing.</Lead>
        <Detail density={d}>
          Recovery is not only about disrupting habit. Habits carry order and structure; freedom without them tips toward
          disorder and absence of meaning.
        </Detail>
      </Frame>
    ),
  },

  // 24c — Finding the sweet spot (SenseForaging 2023 + CUNY seesaw)
  {
    time: '1:48',
    note: 'From the 2023 workshop’s “Finding the Sweet Spot”. Too far into exploiting what you know (the story): depression, anxiety, overwhelm. Too far into exploring (the senses): depersonalization, derealization, detachment. The seesaw from the CUNY deck: habit and sensation, with flourishing at the fulcrum. Workshop prompt: how would you recognise your own anchors of being “too far gone” in each direction?',
    render: () => (
      <Frame wide kicker="Balance">
        <H2>Finding the sweet spot</H2>
        <div style={K.spectrum}>
          <div style={{ ...K.col, textAlign: 'right' }}>
            <div style={{ ...K.colHead(STORY), textAlign: 'right' }}>Too much story</div>
            <div style={{ ...K.pills, justifyContent: 'flex-end' }}>
              {['Depression', 'Anxiety', 'Overwhelm'].map(x => <span key={x} style={K.pill(STORY)}>{x}</span>)}
            </div>
          </div>
          <Fig src="/cuny-2026/s28_anim.gif" alt="Habit and sensation balanced, with flourishing at the fulcrum" h="34vh" />
          <div style={K.col}>
            <div style={K.colHead(SENSE)}>Too much sense</div>
            <div style={K.pills}>
              {['Depersonalization', 'Derealization', 'Detachment'].map(x => <span key={x} style={K.pill(SENSE)}>{x}</span>)}
            </div>
          </div>
        </div>
        <Lead>How would you know you had gone too far in either direction?</Lead>
      </Frame>
    ),
  },

  // 25 — Cautions (with the pitfalls from BuddhistStudies 2019)
  {
    time: '1:51',
    note: 'Essential for a mental health audience. Three pitfalls from the 2019 Buddhist Studies talk. (1) Is opening up always right? For panic, health anxiety or trauma, turning toward the body can raise distress. (2) The acceptance trap: acceptance can become resignation to conditions that should change. (3) The reef of solipsism: turning inward can cut you off from others and from values. Lindahl et al. 2017 documented challenging meditation experiences in Western Buddhist practitioners, some lasting. Good practice: external anchors first, short doses, eyes open, stopping always allowed. From the book’s safety principle: if a practice seems like it might cause harm, pause.',
    render: (d) => (
      <Frame wide kicker="Cautions">
        <H2>Three pitfalls</H2>
        <div style={K.steps}>
          {[
            ['1', 'Is opening up always right?', 'For panic, health anxiety or trauma, attending to the body can raise distress.'],
            ['2', 'The acceptance trap', 'Acceptance can slide into resignation to what should change.'],
            ['3', 'The reef of solipsism', 'Turning inward can cut you off from others and from values.'],
          ].map(([n, t, sub]) => (
            <div key={n} style={K.step}>
              <div style={K.stepN}>{n}</div>
              <div style={{ ...K.stepT, fontSize: 'clamp(18px,2.2vw,26px)' }}>{t}</div>
              <div style={K.stepS}>{sub}</div>
            </div>
          ))}
        </div>
        <Lead>External anchors first, short doses, eyes open, and stopping always allowed.</Lead>
        <Detail density={d}>
          Pitfalls from Farb, “Getting Mindfulness ‘Right’” (2019). Lindahl et al., PLoS ONE 2017, The Varieties of
          Contemplative Experience: challenging meditation-related experiences in Western Buddhist practitioners.
        </Detail>
        <Cite>Lindahl et al., PLoS ONE (2017)</Cite>
      </Frame>
    ),
  },

  // 26 — Synthesis
  {
    time: '1:54',
    note: 'Pull it together. Neither mode is the goal. The story is how we plan, remember, and care for others over time; sense is how new information gets in. Mental health looks less like living in one and more like being able to switch, and knowing which you are in. That is the shared claim of the second arrow, the neuroscience, and MBCT. Open for questions.',
    render: () => (
      <Frame wide kicker="Synthesis">
        <H2>Not one mode. The ability to switch.</H2>
        <TwoModes rows={{
          storySub: 'for planning, memory, caring over time',
          story: ['needs fresh input to stay honest', 'without it: proliferation, rumination', 'the second arrow'],
          senseSub: 'for new information, the present moment',
          sense: ['feeds the story something new', 'without it: the story runs on cache', 'the first arrow, felt and let land'],
        }} />
        <Lead>Know which mode you are in. Be able to move.</Lead>
      </Frame>
    ),
  },

  // 26b — Is my practice working? (BuddhistStudies 2019 criteria)
  {
    time: '1:56',
    note: 'Closing takeaway, from the 2019 talk’s criteria for “right” mindfulness. It does not matter whether a practice is branded as mindfulness; it matters whether it does these four things. Invite them to use it on whatever they already do: running, prayer, music, an app.',
    render: () => (
      <Frame kicker="Take this with you">
        <H2>Is my practice working?</H2>
        <Bullets items={[
          'Does it help me be more flexible in how I relate to experience?',
          'Does it help me turn toward difficulty, rather than avoid it?',
          'Does it help me keep growing, and need it less over time?',
          'Does it make me more curious, rather than more certain?',
        ]} />
        <Lead>Whether it is called mindfulness does not matter.</Lead>
        <Cite>after Farb, “Getting Mindfulness ‘Right’” (2019)</Cite>
      </Frame>
    ),
  },

  // 26c — radlab.zone pitch
  {
    time: '1:57',
    note: 'The pitch. Everything today came from radlab.zone, and all of it stays open. Come, See is the game platform: psychophysics experiments built as games, including the three they just played; a free account saves their history and unlocks the rest of the catalogue. They can also take part in the lab’s studies from there. The lab site has the people, publications and research behind today’s figures, and the book is where the sense-foraging practices live in full.',
    render: () => (
      <Frame wide kicker="Keep going">
        <h1 style={K.title}>radlab.zone</h1>
        <Lead>Rigorous experiments designed to feel like play. Everything you tried today lives there.</Lead>
        <div style={K.steps}>
          {[
            ['Come, See', SENSE, 'The game platform: Delve, Kite, Face Read and more. A free account keeps your history.'],
            ['Take part', '#9a7fc0', 'Join the lab’s studies on sensing, emotion and regulation.'],
            ['The lab', STORY, 'People, publications, and the research behind today’s figures.'],
          ].map(([t, c, sub]) => (
            <div key={t} style={{ ...K.step, borderColor: `${c}66` }}>
              <div style={{ ...K.stepT, color: c }}>{t}</div>
              <div style={K.stepS}>{sub}</div>
            </div>
          ))}
        </div>
        <div style={K.qrRow}>
          <QrPanel path="/" label="radlab.zone" size={170} />
          <QrPanel path="/games" label="All the games" tone={STORY} size={170} />
        </div>
      </Frame>
    ),
  },

  // 27 — Thanks and questions
  {
    time: '1:59',
    render: () => (
      <Frame wide>
        <h1 style={K.title}>Thank you</h1>
        <p style={K.subtitle}>norman.farb@utoronto.ca</p>
        <div style={K.qrRow}>
          <QrPanel path="/prototypes/toggle.html" label="Toggle" size={140} />
          <QrPanel path="/games" label="All the games" tone={STORY} size={140} />
        </div>
        <Bullets items={[
          'Farb & Segal, Better in Every Sense (2024): the sense-foraging practices in full',
          'radlab.zone: the lab, the studies, and the games you tried today',
        ]} />
        <Cite>Regulatory & Affective Dynamics Lab · University of Toronto Mississauga</Cite>
      </Frame>
    ),
    note: 'Leave up for questions. Both QR codes stay live after class: nothing needs an account.',
  },
]

// ── Styles (the Adobe deck shell, plus agenda / sutta / talk / table / QR) ──

const K = {
  stage: {
    position: 'fixed', inset: 0, background: 'var(--bg, #FCF0F5)',
    fontFamily: '"DM Sans",system-ui,sans-serif', color: 'var(--tx)',
    cursor: 'pointer', overflow: 'hidden',
  },
  controls: { position: 'absolute', top: 16, right: 18, zIndex: 5, display: 'flex', gap: 8, cursor: 'default' },
  toggle: { display: 'flex', background: '#fff', border: '1px solid var(--bd)', borderRadius: 999, padding: 2 },
  toggleBtn: { border: 'none', background: 'none', borderRadius: 999, padding: '5px 12px', fontSize: 12, color: 'var(--tx2)', cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  toggleOn: { background: 'var(--pk)', color: '#fff' },
  notesBtn: { border: '1px solid var(--bd)', background: '#fff', borderRadius: 999, padding: '5px 14px', fontSize: 12, color: 'var(--tx2)', cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },

  slideArea: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '52px 40px 56px', overflowY: 'auto' },
  frame: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center', maxWidth: 1000, width: '100%' },
  frameWide: { maxWidth: 'min(1180px, 95vw)' },
  kicker: { fontFamily: '"Space Mono",monospace', fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--pkd)' },

  title:    { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(34px, 6vw, 64px)', fontWeight: 400, color: 'var(--tx)', margin: 0, lineHeight: 1.05 },
  subtitle: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(19px, 3vw, 32px)', fontWeight: 400, color: 'var(--pkd)', margin: 0, fontStyle: 'italic' },
  author:   { fontSize: 'clamp(16px, 2.1vw, 21px)', color: 'var(--tx)', margin: 0, fontWeight: 600 },
  affil:    { fontSize: 'clamp(13px, 1.6vw, 16px)', color: 'var(--tx2)', margin: 0, lineHeight: 1.5, fontFamily: '"Space Mono",monospace' },
  event:    { fontFamily: '"Space Mono",monospace', fontSize: 13, color: 'var(--tx3)', margin: '10px 0 0', letterSpacing: '0.06em' },
  crests:   { display: 'flex', gap: 32, alignItems: 'center', marginBottom: 6 },

  cite: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)', margin: 0, letterSpacing: '0.03em' },

  h2:   { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(24px, 3.6vw, 40px)', fontWeight: 400, color: 'var(--tx)', margin: 0, lineHeight: 1.12 },
  lead: { fontSize: 'clamp(16px, 2vw, 23px)', color: 'var(--tx2)', margin: 0, lineHeight: 1.5, maxWidth: 820 },
  ul:   { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11, maxWidth: 860 },
  li:   { fontSize: 'clamp(15px, 1.9vw, 21px)', color: 'var(--tx)', lineHeight: 1.45, position: 'relative', paddingLeft: 24, textAlign: 'left' },
  detail: { fontSize: 'clamp(13px, 1.5vw, 16px)', color: 'var(--tx2)', lineHeight: 1.6, maxWidth: 760, margin: 0, borderTop: '1px solid var(--bd)', paddingTop: 14 },

  twoCol: { display: 'flex', gap: 40, flexWrap: 'wrap', justifyContent: 'center', width: '100%' },
  col: { flex: '1 1 320px', maxWidth: 480, textAlign: 'left' },
  colHead: (c) => ({ fontFamily: '"Space Mono",monospace', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: c, marginBottom: 10 }),

  modes: { display: 'flex', gap: 18, alignItems: 'stretch', justifyContent: 'center', flexWrap: 'wrap', width: '100%' },
  mode:  { flex: '1 1 300px', maxWidth: 440, background: '#fff', border: '1.5px solid', borderRadius: 18, padding: '18px 22px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 },
  modeTitle: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(20px, 2.6vw, 30px)' },
  modeSub:   { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)', letterSpacing: '0.03em' },
  modeArrow: { alignSelf: 'center', fontSize: 34, color: 'var(--tx3)' },

  chain: { display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', width: '100%' },
  chainStep: { background: '#fff', border: '1.5px solid', borderRadius: 14, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 110, textAlign: 'left' },

  brake: { display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', width: '100%' },
  brakeStep: { flex: '1 1 220px', maxWidth: 300, background: '#fff', border: '1.5px solid', borderRadius: 16, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 4 },

  fig: { margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, maxWidth: '100%' },
  figImg: { maxWidth: '100%', objectFit: 'contain', borderRadius: 12, border: '1px solid var(--bd)', background: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' },
  figRow: { display: 'flex', gap: 18, justifyContent: 'center', alignItems: 'flex-start', flexWrap: 'wrap', width: '100%' },
  pills: { display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  pill: (c) => ({ border: `1.5px solid ${c}66`, color: c, background: '#fff', borderRadius: 999, padding: '6px 16px', fontSize: 'clamp(14px,1.7vw,18px)', fontWeight: 600 }),
  spectrum: { display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 14, alignItems: 'center', width: 'min(900px, 100%)' },
  sutta: { borderLeft: '3px solid var(--pk)', padding: '6px 0 6px 18px', textAlign: 'left', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 6 },
  suttaText: { fontFamily: '"DM Serif Display",Georgia,serif', fontStyle: 'italic', fontSize: 'clamp(16px, 2vw, 23px)', color: 'var(--pkd)', margin: 0, lineHeight: 1.4 },

  talk: { background: '#fff', border: '1px solid var(--bd)', borderRadius: 16, padding: '16px 22px', textAlign: 'left', maxWidth: 820, width: '100%' },
  talkHead: { fontFamily: '"Space Mono",monospace', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--pkd)', marginBottom: 10 },

  agenda: { display: 'flex', flexDirection: 'column', gap: 8, width: 'min(860px, 100%)', textAlign: 'left' },
  agendaRow: { display: 'grid', gridTemplateColumns: '64px minmax(140px, 240px) 1fr', gap: 14, alignItems: 'baseline', background: '#fff', border: '1px solid var(--bd)', borderRadius: 12, padding: '10px 16px' },
  agendaT: { fontFamily: '"Space Mono",monospace', fontSize: 13, color: 'var(--tx3)' },
  agendaH: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(17px, 2vw, 22px)', color: 'var(--tx)' },
  agendaS: { fontSize: 'clamp(13px, 1.5vw, 16px)', color: 'var(--tx2)' },

  table: { display: 'flex', flexDirection: 'column', width: 'min(980px, 100%)', background: '#fff', border: '1px solid var(--bd)', borderRadius: 14, overflow: 'hidden' },
  tr: { display: 'grid', gridTemplateColumns: '160px 1fr 1fr', borderTop: '1px solid var(--bd)' },
  th: { borderTop: 'none', background: '#faf5f8' },
  td: { padding: '12px 16px', textAlign: 'left', fontSize: 'clamp(14px, 1.7vw, 19px)', color: 'var(--tx)' },
  tdHead: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)', letterSpacing: '0.04em', textTransform: 'uppercase' },

  steps: { display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', width: '100%' },
  step:  { flex: '1 1 240px', maxWidth: 300, background: '#fff', border: '1px solid var(--bd)', borderRadius: 18, padding: '20px 22px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6 },
  stepN: { fontFamily: '"Space Mono",monospace', fontSize: 13, color: 'var(--pkd)', letterSpacing: '0.1em' },
  stepT: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(20px, 2.6vw, 30px)', color: 'var(--tx)' },
  stepS: { fontSize: 'clamp(13px, 1.6vw, 17px)', color: 'var(--tx2)', lineHeight: 1.45 },

  qrRow: { display: 'flex', gap: 36, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', width: '100%' },
  station: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, maxWidth: 280, alignSelf: 'flex-start' },
  stationS: { fontSize: 'clamp(13px, 1.5vw, 16px)', color: 'var(--tx2)', margin: 0, lineHeight: 1.45 },

  bottom: { position: 'absolute', bottom: 14, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, cursor: 'default' },
  navArrow: { border: 'none', background: 'none', color: 'var(--tx3)', fontSize: 30, lineHeight: 1, cursor: 'pointer', padding: '0 6px' },
  counter: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)' },
  clickHint: { position: 'absolute', bottom: 44, left: 0, right: 0, textAlign: 'center', fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', opacity: 0.7, pointerEvents: 'none' },

  noteOverlay: { position: 'absolute', bottom: 54, left: '50%', transform: 'translateX(-50%)', width: 'min(760px, 90vw)', background: 'rgba(28,28,30,0.94)', color: '#fff', borderRadius: 12, padding: '14px 20px', cursor: 'default', zIndex: 6 },
  noteLabel: { fontFamily: '"Space Mono",monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#ff9ec9' },
  noteBody: { fontSize: 14, lineHeight: 1.5, marginTop: 6 },
}

// Bullet markers (pink dot) — injected once.
if (typeof document !== 'undefined' && !document.getElementById('bpmh-bullets')) {
  const s = document.createElement('style')
  s.id = 'bpmh-bullets'
  s.textContent = `[data-bpmh] li::before{content:'';position:absolute;left:4px;top:.62em;width:7px;height:7px;border-radius:50%;background:#f068a4}`
  document.head.appendChild(s)
}
