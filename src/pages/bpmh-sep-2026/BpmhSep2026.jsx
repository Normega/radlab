// Buddhism, Psychology & Mental Health · guest lecture · September 2026.
// "Two Ways of Being a Self": a two-hour interactive lecture for upper-year
// undergraduates. Same shell as /adobe-aug-2026 (click / → / Space advance,
// ← back, N speaker notes, Minimal / Reading density). Interactive pieces
// need no login and write nothing: whole-room exercises on the projector
// (BreathCheck, ToggleRoom, BreakTimer) and phone activities reached by QR
// (/prototypes/toggle.html plus the sense-foraging prototypes).
// Speaker notes carry the timings for the two-hour run.
import { useState, useEffect, useCallback } from 'react'
import { BreathCheck } from '../adobe-aug-2026/exercises'
import { ToggleRoom, BreakTimer, QrPanel } from './exercises'

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
            ['0:12', 'Two modes of self', 'Papañca, the second arrow, and the brain’s two self-networks'],
            ['0:32', 'Toggle', 'Switching modes on purpose, as a room and on your phone'],
            ['0:55', 'Break', '10 minutes'],
            ['1:05', 'When the story takes over', 'Stress, rumination, depression, MBCT and decentering'],
            ['1:25', 'Sense foraging', 'Three receptive practices on your phone, then pair talk'],
            ['1:50', 'Synthesis', 'Limits, cautions, questions'],
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
    time: '0:12',
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
    time: '0:14',
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
    time: '0:18',
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
    time: '0:22',
    note: 'Our 2007 study. Participants read trait adjectives and either reflected on what the word said about them (narrative focus) or simply attended to their moment-to-moment experience while reading (experiential focus). Narrative focus engaged midline cortex, mPFC and PCC, the default mode network. Experiential focus shifted activity toward the insula, somatosensory cortex and lateral prefrontal cortex. In novices the two networks were coupled: attempting to sense still pulled the story in. After eight weeks of mindfulness training, the networks decoupled. Link back: the story mode looks like papañca; the sense mode looks like staying nearer to contact and feeling.',
    render: (d) => (
      <Frame wide kicker="Neuroscience">
        <H2>Two self-networks, one brain</H2>
        <TwoModes />
        <Lead>In novices the two were coupled: trying to sense pulled the story in. After training, they came apart.</Lead>
        <Detail density={d}>
          Farb et al., SCAN 2007: narrative self-focus on trait adjectives engaged medial prefrontal and posterior
          cingulate cortex. Experiential focus recruited insula, secondary somatosensory and lateral prefrontal cortex.
          Only participants with 8 weeks of mindfulness training showed reduced coupling between the midline and
          insular regions.
        </Detail>
        <Cite>Farb et al., Soc Cog Affect Neurosci (2007)</Cite>
      </Frame>
    ),
  },

  // 9 — Anattā, carefully
  {
    time: '0:27',
    note: 'Careful framing. Anattā (SN 22.59) is a claim that none of the five aggregates, including feeling and perception, is a lasting self. It is not a claim that people do not exist. One psychological reading: the narrative self is a construction, rebuilt moment to moment, and the experiential mode lets you watch it being built. Push back on the easy mapping: the insula is not “no-self”, and experiential focus still has a subject. Pair question: is the narrative self a problem, or a tool? Two minutes, then two or three answers.',
    render: (d) => (
      <Frame kicker="A careful bridge">
        <H2>Anattā as a psychological hypothesis?</H2>
        <Bullets items={[
          'The claim (SN 22.59): none of the aggregates, form, feeling, perception, formations, consciousness, is a lasting self.',
          'A psychological reading: the narrative self is built moment to moment, and can be watched being built.',
          'Where the mapping breaks: experiential focus still has a subject. The insula is not “no-self”.',
        ]} />
        <Talk who="Pairs" mins={2} items={['Is the story-self a problem, or a tool? When is it each?']} />
        <Detail density={d}>
          Anattalakkhaṇa Sutta, SN 22.59. Treat neuroscience as a lens, not a verdict: brain data can show what
          changes when attention shifts, not whether a metaphysical self exists.
        </Detail>
      </Frame>
    ),
  },

  // 10 — Section: Toggle
  {
    time: '0:32',
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
    time: '0:35',
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
    time: '0:41',
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
    time: '0:46',
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

  // 14 — Break
  {
    time: '0:55',
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
    time: '1:05',
    note: 'Part 2, the mental health block. Why the ability to switch matters clinically.',
    render: () => (
      <Frame>
        <div style={K.kicker}>Part 2</div>
        <h1 style={K.title}>When the story takes over</h1>
        <Lead>Stress, rumination, and why the ability to switch is protective.</Lead>
      </Frame>
    ),
  },

  // 16 — The brake on sensing
  {
    time: '1:07',
    note: 'Our film-clip studies. Sad mood inhibited body-representing and sensory cortex, insula and somatosensory regions; the more inhibition, the higher the depression scores (Emotion 2010). In remitted depressed patients, the same sensory-inhibition signature predicted relapse (Neuroimage: Clinical 2022). Translation: under low mood, the channel that would supply fresh information goes quiet, and the story runs on cached material. That is rumination: papañca without new contact.',
    render: (d) => (
      <Frame wide kicker="Affective neuroscience">
        <H2>Low mood puts a brake on sensing</H2>
        <Brake />
        <Bullets items={[
          'Sad mood quiets the insula and somatosensory cortex; more quieting, more depressive symptoms.',
          'In people recovered from depression, the same signature predicts later relapse.',
          'Rumination: proliferation with no fresh contact to update it.',
        ]} />
        <Detail density={d}>
          Farb et al., Emotion 2010 (N=36): sad film clips reduced insula and somatosensory activation, scaling with
          depression. Neuroimage: Clinical 2022: the sensory-inhibition signature predicted time to relapse in
          remitted patients.
        </Detail>
        <Cite>Farb et al., Emotion 2010 · Neuroimage: Clinical 2022</Cite>
      </Frame>
    ),
  },

  // 17 — Doing and being (MBCT)
  {
    time: '1:12',
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

  // 18 — Decentering and relapse
  {
    time: '1:16',
    note: 'Evidence. Individual-patient meta-analysis (Kuyken 2016, JAMA Psychiatry): MBCT reduced risk of depressive relapse over 60 weeks compared with usual care (hazard ratio about 0.69). In our RCT (Segal 2019, N=156), the mechanism was decentering, the ability to observe a thought or feeling as an event, and practice after the course was what predicted decentering. Link to Toggle: every tap on Story is a rep of exactly that skill.',
    render: (d) => (
      <Frame kicker="Evidence">
        <H2>Decentering: seeing a thought as an event</H2>
        <Bullets items={[
          'MBCT reduces depressive relapse compared with usual care (individual-patient meta-analysis).',
          'In our trial, the protective ingredient was decentering, not relaxation.',
          'Practice after the course predicted decentering. The skill is kept by using it.',
        ]} />
        <Lead>The Toggle tap is one rep of this skill.</Lead>
        <Detail density={d}>
          Kuyken et al., JAMA Psychiatry 2016: MBCT vs usual care, relapse hazard ratio ≈ 0.69 over 60 weeks. Farb et
          al., JCCP 2018 and Segal et al., JCCP 2019 (N=156): decentering mediated relapse protection; follow-up practice
          predicted decentering.
        </Detail>
        <Cite>Kuyken et al. 2016 · Farb et al., JCCP 2018 · Segal et al., JCCP 2019</Cite>
      </Frame>
    ),
  },

  // 19 — Is mindfulness Buddhist? (discussion)
  {
    time: '1:19',
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
    time: '1:25',
    note: 'Part 3. From noticing the story to feeding the senses on purpose.',
    render: () => (
      <Frame>
        <div style={K.kicker}>Part 3</div>
        <h1 style={K.title}>Sense foraging</h1>
        <Lead>Not escaping the story. Feeding it something new.</Lead>
      </Frame>
    ),
  },

  // 21 — What is sense foraging
  {
    time: '1:26',
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

  // 22 — Grasping backfires
  {
    time: '1:30',
    note: 'The design logic of the phone activities. Ordinary apps run a task loop: see, want, act, get. Each of these worlds breaks one link, so that grasping makes things worse and receptivity makes them better. That is taṇhā (craving) made mechanical: you cannot get these by reaching for them. Tell them to notice what happens when they try harder.',
    render: (d) => (
      <Frame wide kicker="Design logic">
        <H2>Worlds where grasping backfires</H2>
        <div style={K.twoCol}>
          <div style={K.col}>
            <div style={K.colHead(STORY)}>Task mode</div>
            <Bullets items={['see → want → act → get', 'Effort pays. Faster is better.', 'The loop most apps are built on.']} />
          </div>
          <div style={K.col}>
            <div style={K.colHead(SENSE)}>Receptive mode</div>
            <Bullets items={['Hurry smears it. Staring puts it out.', 'Slowing down lets it arrive.', 'Craving (taṇhā), made mechanical.']} />
          </div>
        </div>
        <Lead>As you play, notice what happens when you try harder.</Lead>
        <Detail density={d}>
          Each prototype breaks one link of the see → want → act → get chain. Nothing is scored and every world
          reaches an ending whatever you do, so there is nothing to win.
        </Detail>
      </Frame>
    ),
  },

  // 23 — Phone stations
  {
    time: '1:32',
    note: 'About 12 minutes. Everyone picks one, plays for 4 to 5 minutes, then swaps with a neighbour who picked a different one if time allows. Headphones help for Thaw and Sidelong, both have quiet sound. Thaw: rub a fogged window, slowly. Sidelong: faint stars show only beside where you look (true of the real eye: rods peak off the fovea). Soften: press and hold to soften your gaze, and hidden figures appear in the landscape. Walk the room; watch for fast rubbing and staring, and ask what they notice.',
    render: () => (
      <Frame wide kicker="On your phone · 12 min">
        <H2>Pick one. Go slowly.</H2>
        <div style={K.qrRow}>
          <div style={K.station}>
            <QrPanel path="/prototypes/thaw.html" label="Thaw" size={200} />
            <p style={K.stationS}>A fogged window at dusk. Rub gently; hurry smears it.</p>
          </div>
          <div style={K.station}>
            <QrPanel path="/prototypes/sidelong.html" label="Sidelong" tone={STORY} size={200} />
            <p style={K.stationS}>Faint stars appear only beside where you look. Look straight and they go out.</p>
          </div>
          <div style={K.station}>
            <QrPanel path="/prototypes/soften.html" label="Soften" tone="#9a7fc0" size={200} />
            <p style={K.stationS}>Press and hold to soften your gaze. What hides in the valley?</p>
          </div>
        </div>
        <Cite>no login · nothing scored · headphones welcome</Cite>
      </Frame>
    ),
  },

  // 24 — Debrief foraging
  {
    time: '1:44',
    note: 'Pairs 3 minutes, then a few answers. Look for the moment people describe trying harder and it getting worse, then easing off and something appearing. That is the second arrow in miniature: effort aimed at the result instead of the contact. Ask whether anyone felt a pull to “win” and what that was like.',
    render: () => (
      <Frame wide kicker="Debrief">
        <H2>What happened when you tried harder?</H2>
        <Talk who="Pairs" mins={3} items={[
          'Was there a moment you reached for it and it slipped away?',
          'What did you have to let go of for it to arrive?',
          'Where did the story show up: “am I doing this right?”',
        ]} />
        <Lead>Receptivity is a skill, and like decentering it can be practised.</Lead>
      </Frame>
    ),
  },

  // 25 — Cautions
  {
    time: '1:50',
    note: 'Essential for a mental health audience. Turning toward the body is not always calming. For people with panic, health anxiety or trauma histories, interoceptive attention can raise distress. Lindahl et al. 2017 documented a wide range of challenging meditation experiences in Western Buddhist practitioners, some lasting. Good practice: choose external anchors (sound, sight) when internal ones are too much, keep practices brief, keep eyes open, and make stopping always allowed. That is why today’s practices were short and optional.',
    render: (d) => (
      <Frame kicker="Cautions">
        <H2>When sensing is not safe ground</H2>
        <Bullets items={[
          'For panic, health anxiety or trauma, attending to the body can raise distress, not lower it.',
          'Meditation has documented adverse effects, some lasting. They are not rare edge cases.',
          'Good practice: external anchors first, short doses, eyes open, and stopping always allowed.',
        ]} />
        <Lead>The skill is flexibility, not staying in Sense at all costs.</Lead>
        <Detail density={d}>
          Lindahl et al., PLoS ONE 2017, The Varieties of Contemplative Experience: a qualitative study of challenging
          meditation-related experiences in Western Buddhist practitioners.
        </Detail>
        <Cite>Lindahl et al., PLoS ONE (2017)</Cite>
      </Frame>
    ),
  },

  // 26 — Synthesis
  {
    time: '1:53',
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

  // 27 — Thanks and questions
  {
    time: '1:55',
    render: () => (
      <Frame wide>
        <h1 style={K.title}>Thank you</h1>
        <p style={K.subtitle}>norman.farb@utoronto.ca</p>
        <div style={K.qrRow}>
          <QrPanel path="/prototypes/toggle.html" label="Toggle" size={140} />
          <QrPanel path="/prototypes/" label="All the practices" tone={STORY} size={140} />
        </div>
        <Bullets items={[
          'Farb & Segal, Better in Every Sense (2024): the sense-foraging practices in full',
          'radlab.zone: the lab, the studies, and the practices you tried today',
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
