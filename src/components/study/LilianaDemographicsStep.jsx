// ── Liliana Study 3 — full demographics ───────────────────────────────────────
//
// One instrument covering everything in Liliana's approved design
// (`demographics-preview.html`, 18 June 2026): 7 sections, 23 questions.
//
// Why this exists rather than reusing an existing step: the platform had two
// demographics instruments and neither matched the design. `DemographicsStep`
// collects four items (age, gender free-text, racialized, SES ladder). The
// U of T Student Equity Census covers the identity half thoroughly but has no
// Academic Life or Work & Finances section — no student status, campus,
// faculty, living arrangement, income, country of birth, language, marital
// status or employment. Liliana's Study 3 baseline was authored against the
// four-item step, so most of the 23 designed questions were never collected.
//
// The identity questions REUSE the census's option sets and controls
// (`EquityCensusStep` exports them) rather than restating them. Those lists
// carry the census's own definitions and a "Prefer not to answer" on every
// item, so sharing them keeps the two instruments from drifting apart and the
// wording stays the U of T published wording. The sections the census lacks
// are defined below.
//
// NOTE FOR REVIEW: the preview offered no "Prefer not to answer" on several
// questions. Because the shared identity sets all carry PNA, those were
// inconsistent with the rest of the instrument; PNA has been added to household
// income and marital status, the two most sensitive of them. Disability yes/no
// and employment follow the preview as designed. Flagged for Liliana.

import { useState, useEffect, useRef } from 'react'
import { supabase as globalSupabase } from '../../lib/supabase'
import {
  PNA, GENDER_OPTIONS, TRANS_OPTIONS, TRANS_DEF, ORIENTATION_OPTIONS,
  DISABILITY_DEF, DISABILITY_TYPE_OPTIONS, RACE_OPTIONS, RELIGION_OPTIONS,
  PARENT_EDU_OPTIONS, toggleMulti, CheckGroup, ButtonRow, RaceGroup,
} from './EquityCensusStep'

// ── Option sets the census does not carry ─────────────────────────────────────

const AGE_OPTIONS = [
  ...Array.from({ length: 9 }, (_, i) => ({ value: String(17 + i), label: String(17 + i) })),
  { value: 'other', label: 'Other (please specify)', specify: true },
]

const RELIGIOSITY_OPTIONS = [
  { value: 'very',       label: 'Very religious' },
  { value: 'fairly',     label: 'Fairly religious' },
  { value: 'not_too',    label: 'Not too religious' },
  { value: 'not_at_all', label: 'Not at all religious' },
]

const DISABILITY_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no',  label: 'No' },
]

const STUDENT_STATUS_OPTIONS = [
  { value: 'part_time', label: 'Part-time' },
  { value: 'full_time', label: 'Full-time' },
]

const STUDENT_ORIGIN_OPTIONS = [
  { value: 'domestic',      label: 'Domestic' },
  { value: 'international', label: 'International' },
]

const RESIDENCE_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no',  label: 'No, I live off campus' },
]

const LIVING_OPTIONS = [
  { value: 'alone',     label: 'Living alone' },
  { value: 'roommates', label: 'Living with roommates/friends' },
  { value: 'parents',   label: 'Living with parents' },
  { value: 'family',    label: 'Living with other family' },
  { value: 'partner',   label: 'Living with a partner' },
  { value: 'other',     label: 'Other (please specify)', specify: true },
]

const CAMPUS_OPTIONS = [
  { value: 'st_george',   label: 'St. George' },
  { value: 'mississauga', label: 'Mississauga' },
  { value: 'scarborough', label: 'Scarborough' },
]

const FACULTY_OPTIONS = [
  { value: 'humanities_social', label: 'Humanities & Social Sciences' },
  { value: 'life_sciences',     label: 'Life Sciences' },
  { value: 'physical_math',     label: 'Physical & Mathematical Sciences' },
  { value: 'commerce',          label: 'Commerce & Management' },
  { value: 'computer_science',  label: 'Computer Science' },
  { value: 'engineering',       label: 'Engineering' },
  { value: 'kinesiology',       label: 'Kinesiology & Physical Education' },
  { value: 'music_arch',        label: 'Music and Architecture' },
  { value: 'other',             label: 'Other (please specify)', specify: true },
]

const WORK_HOURS_OPTIONS = [
  { value: '0',       label: '0' },
  { value: '1_5',     label: '1-5 hours' },
  { value: '6_10',    label: '6-10 hours' },
  { value: '11_15',   label: '11-15 hours' },
  { value: '16_20',   label: '16-20 hours' },
  { value: '20_plus', label: '20+ hours' },
]

const ENGLISH_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no',  label: 'No' },
]

const INCOME_OPTIONS = [
  { value: 'lt_20k',   label: 'Less than $20,000' },
  { value: '20_34k',   label: '$20,000 to $34,999' },
  { value: '35_49k',   label: '$35,000 to $49,999' },
  { value: '50_74k',   label: '$50,000 to $74,999' },
  { value: '75_99k',   label: '$75,000 to $99,999' },
  { value: '100_149k', label: '$100,000 to $149,999' },
  { value: '150_199k', label: '$150,000 to $199,999' },
  { value: 'gte_200k', label: '$200,000 or more' },
  { value: PNA,        label: 'Prefer not to answer' },
]

const MARITAL_OPTIONS = [
  { value: 'single',   label: 'Single/never been married' },
  { value: 'married',  label: 'Married or domestic partnership' },
  { value: 'divorced', label: 'Divorced or separated' },
  { value: 'widowed',  label: 'Widowed' },
  { value: PNA,        label: 'Prefer not to answer' },
]

const HAS_JOB_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no',  label: 'No' },
]

const JOB_TYPE_OPTIONS = [
  { value: 'part_time', label: 'Part time (30 hours or less per week)' },
  { value: 'full_time', label: 'Full time (more than 30 hours a week)' },
]

const SECTIONS = [
  'About You', 'Gender & Orientation', 'Race & Ethnicity',
  'Religion & Spirituality', 'Disability', 'Academic Life', 'Work & Finances',
]

// A question block. Declared outside the component body would lose access to
// nothing it needs, but keeping it here keeps the section markup readable.
function Q({ n, label, instruction, def, children }) {
  return (
    <div style={S.q}>
      <div style={S.qLabel}><span style={S.qNum}>{n}</span>{label}</div>
      {instruction && <div style={S.instruction}>{instruction}</div>}
      {def && <div style={S.def}>{def}</div>}
      {children}
    </div>
  )
}

export default function LilianaDemographicsStep({
  enrollment, scheduleId, onComplete, supabaseClient,
  isSimMode = false, previewMode = false,
}) {
  const db = supabaseClient ?? globalSupabase

  const [sec, setSec] = useState(0)

  const [age, setAge] = useState(null)
  const [gender, setGender] = useState([])
  const [trans, setTrans] = useState(null)
  const [orientation, setOrientation] = useState([])
  const [race, setRace] = useState([])
  const [religion, setReligion] = useState([])
  const [religiosity, setReligiosity] = useState(null)
  const [disability, setDisability] = useState(null)
  const [disabilityTypes, setDisabilityTypes] = useState([])
  const [studentStatus, setStudentStatus] = useState(null)
  const [studentOrigin, setStudentOrigin] = useState(null)
  const [residence, setResidence] = useState(null)
  const [living, setLiving] = useState(null)
  const [campus, setCampus] = useState(null)
  const [faculty, setFaculty] = useState(null)
  const [parentEdu, setParentEdu] = useState(null)
  const [workHours, setWorkHours] = useState(null)
  const [countryBirth, setCountryBirth] = useState('')
  const [english, setEnglish] = useState(null)
  const [income, setIncome] = useState(null)
  const [marital, setMarital] = useState(null)
  const [hasJob, setHasJob] = useState(null)
  const [jobType, setJobType] = useState(null)

  const [specify, setSpecify] = useState({})
  const [saving, setSaving] = useState(false)
  const submittingRef = useRef(false)
  const [error, setError] = useState(null)

  const setSpecifyText = (k, t) => setSpecify(prev => ({ ...prev, [k]: t }))

  function buildResponses() {
    const ageNum = age === 'other' ? Number(specify.age) : Number(age)
    return {
      // Stored as a number whenever it parses, so analysis never has to unpick
      // an option token; the raw entry is kept when the participant typed one.
      age: Number.isFinite(ageNum) ? ageNum : null,
      age_other: age === 'other' ? (specify.age ?? '') : null,

      gender_identity:          gender,
      gender_identity_other:    gender.includes('not_listed') ? (specify.gender ?? '') : null,
      trans_identity:           trans,
      sexual_orientation:       orientation,
      sexual_orientation_other: orientation.includes('not_listed') ? (specify.orientation ?? '') : null,

      race_ethnicity: race,
      race_ethnicity_specify: Object.fromEntries(
        Object.entries(specify)
          .filter(([k]) => k.startsWith('race:') && race.includes(k.slice(5)))
          .map(([k, v]) => [k.slice(5), v])
      ),

      religion,
      religion_other: religion.includes('not_listed') ? (specify.religion ?? '') : null,
      religiosity,

      disability,
      disability_types:       disability === 'yes' ? disabilityTypes : [],
      disability_types_other: disability === 'yes' && disabilityTypes.includes('not_listed')
        ? (specify.disability ?? '')
        : null,

      student_status: studentStatus,
      student_origin: studentOrigin,
      uoft_residence: residence,
      living_arrangement:       living,
      living_arrangement_other: living === 'other' ? (specify.living ?? '') : null,
      campus,
      faculty,
      faculty_other: faculty === 'other' ? (specify.faculty ?? '') : null,
      parent_education:       parentEdu,
      parent_education_other: parentEdu === 'not_listed' ? (specify.parent_edu ?? '') : null,

      paid_work_hours:  workHours,
      country_of_birth: countryBirth.trim() || null,
      english_primary:  english,
      household_income: income,
      marital_status:   marital,
      has_job:          hasJob,
      // Only meaningful when they have one; null otherwise, so "not asked" and
      // "asked and skipped" stay distinguishable in the data.
      job_type:         hasJob === 'yes' ? jobType : null,
    }
  }

  async function insertResponses(responses) {
    return db.from('liliana_demographics').insert({
      user_id:       enrollment?.profile_id ?? enrollment?.user_id ?? null,
      enrollment_id: enrollment?.id ?? null,
      schedule_id:   scheduleId ?? null,
      responses,
    })
  }

  // Sim mode: prefer-not-to-answer where offered, a plausible pick otherwise.
  useEffect(() => {
    if (!isSimMode) return
    setAge('21'); setGender([PNA]); setTrans(PNA); setOrientation([PNA])
    setRace([PNA]); setReligion([PNA]); setReligiosity('not_at_all')
    setDisability('no'); setStudentStatus('full_time'); setStudentOrigin('domestic')
    setResidence('no'); setLiving('roommates'); setCampus('mississauga')
    setFaculty('life_sciences'); setParentEdu(PNA); setWorkHours('0')
    setCountryBirth('Canada'); setEnglish('yes'); setIncome(PNA); setMarital(PNA)
    setHasJob('no')
    const t = setTimeout(async () => {
      if (!previewMode) {
        setSaving(true)
        const { error: dbErr } = await insertResponses({
          age: 21, age_other: null,
          gender_identity: [PNA], gender_identity_other: null, trans_identity: PNA,
          sexual_orientation: [PNA], sexual_orientation_other: null,
          race_ethnicity: [PNA], race_ethnicity_specify: {},
          religion: [PNA], religion_other: null, religiosity: 'not_at_all',
          disability: 'no', disability_types: [], disability_types_other: null,
          student_status: 'full_time', student_origin: 'domestic', uoft_residence: 'no',
          living_arrangement: 'roommates', living_arrangement_other: null,
          campus: 'mississauga', faculty: 'life_sciences', faculty_other: null,
          parent_education: PNA, parent_education_other: null,
          paid_work_hours: '0', country_of_birth: 'Canada', english_primary: 'yes',
          household_income: PNA, marital_status: PNA, has_job: 'no', job_type: null,
        })
        setSaving(false)
        if (dbErr) console.error('sim liliana demographics insert:', dbErr)
      }
      onComplete({})
    }, 500)
    return () => clearTimeout(t)
  }, [isSimMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Per-section gate. A "please specify" choice is not complete until its box
  // has text, so nobody advances past a half-answered option.
  const spec = k => (specify[k] ?? '').trim().length > 0
  const openEnded = (val, key) => (val === 'other' || val === 'not_listed' ? spec(key) : true)

  const sectionValid = [
    age !== null && openEnded(age, 'age'),
    gender.length > 0 && (!gender.includes('not_listed') || spec('gender'))
      && trans !== null
      && orientation.length > 0 && (!orientation.includes('not_listed') || spec('orientation')),
    race.length > 0,
    religion.length > 0 && (!religion.includes('not_listed') || spec('religion')) && religiosity !== null,
    disability !== null && (disability !== 'yes' || disabilityTypes.length > 0),
    studentStatus !== null && studentOrigin !== null && residence !== null
      && living !== null && openEnded(living, 'living')
      && campus !== null && faculty !== null && openEnded(faculty, 'faculty')
      && parentEdu !== null && openEnded(parentEdu, 'parent_edu'),
    workHours !== null && countryBirth.trim().length > 0 && english !== null
      && income !== null && marital !== null
      && hasJob !== null && (hasJob !== 'yes' || jobType !== null),
  ]

  const isLast = sec === SECTIONS.length - 1

  async function handleNext() {
    if (!sectionValid[sec] || saving) return
    if (!isLast) { setSec(s => s + 1); window.scrollTo?.(0, 0); return }
    if (previewMode) { onComplete({ preview: true, responses: buildResponses() }); return }
    // Ref, not just `saving`: setSaving(true) does not take effect until React
    // re-renders, so two events dispatched in the same tick both read
    // saving === false and both insert. Written synchronously, so the second
    // call sees the lock the first one set. Released only on failure — a
    // completed submit must never repeat, but a failed one must be retryable.
    if (submittingRef.current) return
    submittingRef.current = true
    setSaving(true); setError(null)
    const { error: dbErr } = await insertResponses(buildResponses())
    setSaving(false)
    if (dbErr) {
      submittingRef.current = false
      setError('Could not save — please try again.')
      console.error('liliana demographics insert:', dbErr)
      return
    }
    onComplete({})
  }

  return (
    <div style={S.wrap}>
      <div style={S.progressTrack}>
        <div style={{ ...S.progressFill, width: `${((sec + 1) / SECTIONS.length) * 100}%` }} />
      </div>
      <div style={S.topRow}>
        <span style={S.badge}>Demographics</span>
        <span style={S.counter}>Section {sec + 1} of {SECTIONS.length}</span>
      </div>
      <h1 style={S.title}>{SECTIONS[sec]}</h1>

      {sec === 0 && (
        <>
          <p style={S.sub}>
            These questions help us understand the variety of people who take part in this
            study. All responses are confidential.
          </p>
          <Q n="1" label="How old are you?">
            <ButtonRow options={AGE_OPTIONS} value={age} onChange={setAge} />
            {age === 'other' && (
              <input
                style={S.input}
                placeholder="Please specify your age"
                value={specify.age ?? ''}
                onChange={e => setSpecifyText('age', e.target.value)}
              />
            )}
          </Q>
        </>
      )}

      {sec === 1 && (
        <>
          <Q
            n="2"
            label="Please indicate which of the following terms best describes your gender identity."
            instruction="Check as many as apply."
          >
            <CheckGroup
              options={GENDER_OPTIONS}
              selected={gender}
              onToggle={v => setGender(s => toggleMulti(GENDER_OPTIONS, s, v))}
              specifyText={specify.gender ?? ''}
              onSpecify={t => setSpecifyText('gender', t)}
            />
          </Q>
          <Q
            n="3"
            label="Do you identify as trans or consider yourself to be part of a trans community?"
            def={TRANS_DEF}
          >
            <ButtonRow options={TRANS_OPTIONS} value={trans} onChange={setTrans} />
          </Q>
          <Q
            n="4"
            label="Please indicate which of the following terms best describes your sexual orientation."
            instruction="Check as many as apply."
          >
            <CheckGroup
              options={ORIENTATION_OPTIONS}
              selected={orientation}
              onToggle={v => setOrientation(s => toggleMulti(ORIENTATION_OPTIONS, s, v))}
              specifyText={specify.orientation ?? ''}
              onSpecify={t => setSpecifyText('orientation', t)}
            />
          </Q>
        </>
      )}

      {sec === 2 && (
        <Q
          n="5"
          label="Please indicate which of the following terms best describe your racial and/or ethnocultural identity."
          instruction="Check as many terms as apply to you. Selecting a category reveals more specific options."
        >
          <RaceGroup
            options={RACE_OPTIONS}
            selected={race}
            setSelected={setRace}
            specify={specify}
            onSpecify={setSpecifyText}
          />
        </Q>
      )}

      {sec === 3 && (
        <>
          <Q
            n="6"
            label="Which of the following best reflect your religious identity, spiritual traditions or beliefs?"
            instruction="Check as many as apply."
          >
            <CheckGroup
              options={RELIGION_OPTIONS}
              selected={religion}
              onToggle={v => setReligion(s => toggleMulti(RELIGION_OPTIONS, s, v))}
              specifyText={specify.religion ?? ''}
              onSpecify={t => setSpecifyText('religion', t)}
            />
          </Q>
          <Q n="7" label="How religious do you consider yourself to be?">
            <ButtonRow options={RELIGIOSITY_OPTIONS} value={religiosity} onChange={setReligiosity} />
          </Q>
        </>
      )}

      {sec === 4 && (
        <>
          <Q n="8" label="Do you identify as a person with a disability?" def={DISABILITY_DEF}>
            <ButtonRow options={DISABILITY_OPTIONS} value={disability} onChange={setDisability} />
          </Q>
          {disability === 'yes' && (
            <Q
              n="9"
              label="Please indicate which of the following best describe your disability/ies."
              instruction="Check as many as apply."
            >
              <CheckGroup
                options={DISABILITY_TYPE_OPTIONS}
                selected={disabilityTypes}
                onToggle={v => setDisabilityTypes(s => toggleMulti(DISABILITY_TYPE_OPTIONS, s, v))}
                specifyText={specify.disability ?? ''}
                onSpecify={t => setSpecifyText('disability', t)}
              />
            </Q>
          )}
        </>
      )}

      {sec === 5 && (
        <>
          <Q n="10" label="What is your current student status?">
            <ButtonRow options={STUDENT_STATUS_OPTIONS} value={studentStatus} onChange={setStudentStatus} />
          </Q>
          <Q n="11" label="Please indicate whether you are a domestic or international student.">
            <ButtonRow options={STUDENT_ORIGIN_OPTIONS} value={studentOrigin} onChange={setStudentOrigin} />
          </Q>
          <Q n="12" label="Do you live in a University of Toronto residence?">
            <ButtonRow options={RESIDENCE_OPTIONS} value={residence} onChange={setResidence} />
          </Q>
          <Q n="13" label="What is your current living arrangement?">
            <ButtonRow options={LIVING_OPTIONS} value={living} onChange={setLiving} />
            {living === 'other' && (
              <input
                style={S.input}
                placeholder="Please specify"
                value={specify.living ?? ''}
                onChange={e => setSpecifyText('living', e.target.value)}
              />
            )}
          </Q>
          <Q n="14" label="What is your campus?">
            <ButtonRow options={CAMPUS_OPTIONS} value={campus} onChange={setCampus} />
          </Q>
          <Q n="15" label="What faculty are you enrolled in?">
            <ButtonRow options={FACULTY_OPTIONS} value={faculty} onChange={setFaculty} />
            {faculty === 'other' && (
              <input
                style={S.input}
                placeholder="Please specify"
                value={specify.faculty ?? ''}
                onChange={e => setSpecifyText('faculty', e.target.value)}
              />
            )}
          </Q>
          <Q n="16" label="What is the highest level of formal education of your most highly educated parent or guardian?">
            <CheckGroup
              options={PARENT_EDU_OPTIONS}
              selected={parentEdu ? [parentEdu] : []}
              onToggle={v => setParentEdu(p => (p === v ? null : v))}
              specifyText={specify.parent_edu ?? ''}
              onSpecify={t => setSpecifyText('parent_edu', t)}
            />
          </Q>
        </>
      )}

      {sec === 6 && (
        <>
          <Q n="17" label="How many hours per week do you do paid work?">
            <ButtonRow options={WORK_HOURS_OPTIONS} value={workHours} onChange={setWorkHours} />
          </Q>
          <Q n="18" label="What country were you born in?">
            <input
              style={S.input}
              placeholder="Please indicate the country"
              value={countryBirth}
              onChange={e => setCountryBirth(e.target.value)}
            />
          </Q>
          <Q n="19" label="Is English your primary language?">
            <ButtonRow options={ENGLISH_OPTIONS} value={english} onChange={setEnglish} />
          </Q>
          <Q n="20" label="What is your average annual household income?">
            <ButtonRow options={INCOME_OPTIONS} value={income} onChange={setIncome} />
          </Q>
          <Q n="21" label="What is your current marital status?">
            <ButtonRow options={MARITAL_OPTIONS} value={marital} onChange={setMarital} />
          </Q>
          <Q n="22" label="Do you currently have a job?">
            <ButtonRow options={HAS_JOB_OPTIONS} value={hasJob} onChange={setHasJob} />
          </Q>
          {hasJob === 'yes' && (
            <Q n="23" label="Is your job:">
              <ButtonRow options={JOB_TYPE_OPTIONS} value={jobType} onChange={setJobType} />
            </Q>
          )}
        </>
      )}

      {error && <div style={S.error}>{error}</div>}

      <div style={S.footer}>
        {sec > 0 && (
          <button
            style={S.back}
            onClick={() => { setSec(s => s - 1); window.scrollTo?.(0, 0) }}
            disabled={saving}
          >
            Back
          </button>
        )}
        <button
          style={{ ...S.next, ...(sectionValid[sec] ? {} : S.nextDisabled) }}
          onClick={handleNext}
          disabled={!sectionValid[sec] || saving}
        >
          {saving ? 'Saving…' : isLast ? 'Submit' : 'Next'}
        </button>
      </div>
    </div>
  )
}

const S = {
  wrap: { maxWidth: 640, margin: '0 auto', padding: '0 20px 40px', fontFamily: "'DM Sans', system-ui, sans-serif" },
  progressTrack: { height: 3, background: '#e0ddd8', borderRadius: 999, marginBottom: 14 },
  progressFill:  { height: '100%', background: '#639922', borderRadius: 999, transition: 'width 0.3s' },
  topRow:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  badge:   { fontFamily: "'Space Mono', monospace", fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--tx2)' },
  counter: { fontSize: 12, color: 'var(--gy)' },
  title:   { fontFamily: "'DM Serif Display', serif", fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: '0 0 8px' },
  sub:     { fontSize: 14, lineHeight: 1.6, color: 'var(--tx2)', margin: '0 0 20px' },
  q:       { marginBottom: 28 },
  qLabel:  { fontSize: 16, fontWeight: 600, color: 'var(--tx)', lineHeight: 1.5, marginBottom: 6 },
  qNum:    { fontFamily: "'Space Mono', monospace", fontSize: 12, color: 'var(--gy)', marginRight: 8 },
  instruction: { fontSize: 14, color: 'var(--tx2)', fontStyle: 'italic', marginBottom: 10 },
  def:     { fontSize: 12, lineHeight: 1.55, color: 'var(--tx2)', background: '#faf9f7', borderRadius: 12, padding: 12, marginBottom: 10 },
  input:   { width: '100%', border: '1px solid var(--bd)', borderRadius: 12, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', color: 'var(--tx)', marginTop: 8 },
  error:   { background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err-tx)', borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 16 },
  footer:  { display: 'flex', gap: 10, marginTop: 8 },
  back:    { flex: 1, border: '1px solid var(--bd)', background: 'transparent', color: 'var(--tx2)', borderRadius: 24, padding: '13px 20px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  next:    { flex: 2, border: 'none', background: 'var(--tx)', color: '#fff', borderRadius: 24, padding: '13px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  nextDisabled: { opacity: 0.35, cursor: 'not-allowed' },
}
