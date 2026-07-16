import { useState, useEffect } from 'react'
import { supabase as globalSupabase } from '../../lib/supabase'

// ── U of T Student Equity Census ────────────────────────────────────────────
// Reproduction of the 2025-2026 U of T Student Equity Census (Office of the
// Vice-Provost, Students). All questions required; every question offers
// "Prefer not to answer". Responses stored as a single jsonb blob in
// equity_census_responses (see supabase/migrations/20260713_equity_census.sql).
//
// Registered in src/components/study/advancedInstruments.js — keep that entry
// in sync if this instrument's name, storage, or delivery changes.

const PNA = 'prefer_not_to_answer'

// ── Q1 Gender identity ──────────────────────────────────────────────────────
const GENDER_OPTIONS = [
  { value: 'genderfluid', label: 'Genderfluid', def: 'Gender fluidity conveys a wider, more flexible range of gender expression, with interests and behaviors that may change from day to day. Gender fluid people do not feel confined by restrictive boundaries of stereotypical expectations of women or men. In other words, they may feel they are a woman some days and a man on others, or possibly feel that neither term describes them accurately.' },
  { value: 'genderqueer', label: 'Genderqueer', def: 'Individuals who do not follow gender stereotypes based on the sex they were assigned at birth. They may identify and express themselves as "feminine men" or "masculine women" or as androgynous, outside of the categories "boy/man" and "girl/woman."' },
  { value: 'man', label: 'Man (cis, trans)', def: 'A person whose gender identity may correspond with social expectations associated with being a man and/or masculine. People who identify as men may be cis (gender identity ‘matches’ birth assigned sex) or trans (gender identity is different from birth assigned sex).' },
  { value: 'nonbinary', label: 'Nonbinary', def: 'An umbrella term for gender identities that fall outside of the man-woman binary.' },
  { value: 'questioning', label: 'Questioning', def: 'When a person is exploring their own gender identity or is unsure with regards to their gender identity.' },
  { value: 'two_spirit', label: 'Two-Spirit', def: 'An all-encompassing term used to describe gender and sexual diversity in Indigenous communities. Two-Spirit people often serve integral and important roles in their communities, such as leaders and healers. There are many understandings of the term Two-Spirit – and this English term does not resonate for everyone. Two-Spirit is a cultural term reserved for those who identify as Indigenous.' },
  { value: 'woman', label: 'Woman (cis, trans)', def: 'A person whose gender identity may correspond with social expectations associated with being a woman and/or feminine. People who identify as women may be cis (gender identity ‘matches’ birth assigned sex) or trans (gender identity is different from birth assigned sex).' },
  { value: 'not_listed', label: 'An identity not listed (please specify)', specify: true },
  { value: PNA, label: 'Prefer not to answer', exclusive: true },
]

const TRANS_DEF = 'A person who identifies as trans or as a part of a trans community could identify with a gender other than the one assigned to them at birth, might have a gender identity and/or gender expression which differs from the stereotypical masculine and feminine norms, or other analogous identities or experiences. Trans can be an umbrella term to include a broad array of people including those who identify as trans, transgender, transsexual, genderqueer, gender fluid, nonbinary, or another term.'

const TRANS_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not_sure', label: 'Not sure' },
  { value: PNA, label: 'Prefer not to answer' },
]

// ── Q2 Sexual orientation ───────────────────────────────────────────────────
const ORIENTATION_OPTIONS = [
  { value: 'asexual', label: 'Asexual', def: 'A person who experiences little or no sexual attraction to people of any gender.' },
  { value: 'bisexual', label: 'Bisexual', def: 'A person who is attracted to people of more than one gender.' },
  { value: 'gay', label: 'Gay', def: 'A person who is attracted to people of the same gender.' },
  { value: 'heterosexual', label: 'Heterosexual / Straight', def: 'A person who is attracted to people of the opposite gender.' },
  { value: 'lesbian', label: 'Lesbian', def: 'A woman who is attracted to women.' },
  { value: 'pansexual', label: 'Pansexual', def: 'A person who is attracted to other people regardless of gender.' },
  { value: 'queer', label: 'Queer', def: 'An umbrella term used for LGBTQ2S+; reclaimed by some whose sexual orientations and/or gender identities fall outside of cisgender/straight norms.' },
  { value: 'questioning', label: 'Questioning', def: 'When a person is exploring their sexual identity and/or orientation or is unsure with regards to their sexual identity and/or orientation.' },
  { value: 'two_spirit', label: 'Two-Spirit', def: 'An all-encompassing term used to describe gender and sexual diversity in Indigenous communities. Two-Spirit people often serve integral and important roles in their communities, such as leaders and healers. There are many understandings of the term Two-Spirit – and this English term does not resonate for everyone. Two-Spirit is a cultural term reserved for those who identify as Indigenous.' },
  { value: 'not_listed', label: 'An identity not listed (please specify)', specify: true },
  { value: PNA, label: 'Prefer not to answer', exclusive: true },
]

// ── Q3 Disability ───────────────────────────────────────────────────────────
const DISABILITY_DEF = 'Persons with disabilities include those who may experience barriers to full participation in University life as a result of long-term, temporary, or episodic physical, mental/emotional, sensory, or learning disabilities, including those caused by chronic health conditions. It should also be noted that the social model of disability recognizes that disability is not created by any medical or physical condition, but rather by societal barriers. A disability may be evident or non-evident.'

const DISABILITY_TYPE_OPTIONS = [
  { value: 'adhd', label: 'Attention deficit and hyperactivity disorder (ADHD)' },
  { value: 'asd', label: 'Autism spectrum disorder (ASD)' },
  { value: 'chronic_health', label: "Chronic health condition (e.g., Auto-immune conditions, Crohn's disease, diabetes, cancer, etc.)" },
  { value: 'concussion_head_injury', label: 'Concussion / head injury' },
  { value: 'learning_disability', label: 'Learning disability (LD)' },
  { value: 'mental_health', label: 'Mental health condition (e.g., schizophrenia, depression, anxiety disorder, bipolar disorder, PTSD, etc.)' },
  { value: 'mobility_functional', label: 'Mobility or functional disability' },
  { value: 'sensory', label: 'Sensory disability (e.g., vision or hearing)' },
  { value: 'temporary', label: 'Temporary disability/injury (e.g., broken bone)' },
  { value: 'not_listed', label: 'A disability not listed (please specify)', specify: true },
  { value: PNA, label: 'Prefer not to answer', exclusive: true },
]

// ── Q4 Indigenous identity ──────────────────────────────────────────────────
const INDIGENOUS_ID_OPTIONS = [
  { value: 'alaska_native', label: 'Alaska Native' },
  { value: 'first_nations_non_status', label: 'First Nations (non-status, non-treaty, and non-registered)' },
  { value: 'first_nations_status', label: 'First Nations (status, treaty, or registered)' },
  { value: 'inuit', label: 'Inuit' },
  { value: 'metis', label: 'Métis' },
  { value: 'native_american', label: 'Native American' },
  { value: 'native_hawaiian', label: 'Native Hawaiian' },
  { value: 'native_mexican', label: 'Native Mexican' },
  { value: 'not_listed', label: 'An identity not listed (please specify)', specify: true },
  { value: PNA, label: 'Prefer not to answer', exclusive: true },
]

// ── Q5 Racial and/or ethnocultural identity ─────────────────────────────────
const RACIALIZED_DEF = 'The Ontario Human Rights Commission defines racialization as a process by which societies construct races as real, different and unequal in ways that matter and affect economic, political and social life.'

const RACE_OPTIONS = [
  {
    value: 'asian', label: 'Asian',
    children: [
      { value: 'caribbean', label: 'Caribbean (e.g., Guyanese, Trinidadian, Jamaican)' },
      { value: 'central_asian', label: 'Central Asian (e.g., Kazakhstani, Uzbekistani)' },
      { value: 'east_asian', label: 'East Asian (e.g., Chinese, Japanese, Korean)' },
      { value: 'european', label: 'European (e.g., British, French, Portuguese, Spanish)' },
      { value: 'north_american', label: 'North American (e.g., American, Canadian)' },
      { value: 'south_asian', label: 'South Asian (e.g., Indian, Pakistani, Sri Lankan, Bangladeshi)' },
      { value: 'southeast_asian', label: 'Southeast Asian (e.g., Filipino, Malaysian, Vietnamese)' },
      { value: 'self_identify', label: 'Prefer to self-identify (please specify)', specify: true },
    ],
  },
  {
    value: 'black', label: 'Black',
    children: [
      { value: 'african', label: 'African (e.g., Ghanaian, Kenyan, Somali)' },
      { value: 'caribbean', label: 'Caribbean (e.g., Bajan, Grenadian, Jamaican)' },
      { value: 'european', label: 'European (e.g., British, French, Portuguese, Spanish)' },
      { value: 'north_american', label: 'North American (e.g., American, Canadian)' },
      { value: 'south_central_american', label: 'South and Central American (e.g., Brazilian, Panamanian)' },
      { value: 'self_identify', label: 'Prefer to self-identify (please specify)', specify: true },
    ],
  },
  {
    value: 'indigenous_turtle_island', label: 'Indigenous person of Turtle Island (North America)',
    children: [
      { value: 'alaska_native', label: 'Alaska Native' },
      { value: 'first_nations', label: 'First Nations' },
      { value: 'inuk', label: 'Inuk (Inuit)' },
      { value: 'metis', label: 'Metis' },
      { value: 'native_american', label: 'Native American' },
      { value: 'native_hawaiian', label: 'Native Hawaiian' },
      { value: 'native_mexican', label: 'Native Mexican' },
      { value: 'self_identify', label: 'Prefer to self-identify with other descriptors (e.g., Nation, Tribe, Clan, Band, Family, etc.) (please specify)', specify: true },
    ],
  },
  {
    value: 'indigenous_outside_turtle_island', label: 'Indigenous person from outside Turtle Island (North America) (e.g., Aboriginal Person of Australia, Pacific Islander)',
    children: [
      { value: 'self_identify', label: 'Prefer to self-identify (please specify)', specify: true },
    ],
  },
  {
    value: 'latino', label: 'Latino/a/x',
    children: [
      { value: 'caribbean', label: 'Caribbean (e.g., Cuban, Haitian)' },
      { value: 'central_american', label: 'Central American (e.g., Honduran, Nicaraguan)' },
      { value: 'european', label: 'European (e.g., British, French, Portuguese, Spanish)' },
      { value: 'north_american', label: 'North American (e.g., American, Canadian, Mexican)' },
      { value: 'south_american', label: 'South American (e.g., Argentinian, Brazilian)' },
      { value: 'self_identify', label: 'Prefer to self-identify (please specify)', specify: true },
    ],
  },
  {
    value: 'mena_swa', label: 'Middle Eastern, North African, and Southwest Asian',
    children: [
      { value: 'european', label: 'European (e.g., British, French, Portuguese, Spanish)' },
      { value: 'middle_eastern', label: 'Middle Eastern (e.g., Israeli, Lebanese, Palestinian, Syrian)' },
      { value: 'north_african', label: 'North African (e.g., Egyptian, Libyan, Moroccan)' },
      { value: 'north_american', label: 'North American (e.g., American, Canadian)' },
      { value: 'southwest_asian', label: 'Southwest Asian (e.g., Afghan, Iranian)' },
      { value: 'self_identify', label: 'Prefer to self-identify (please specify)', specify: true },
    ],
  },
  { value: 'multiracial', label: 'Multiracial (People who may not identify with a singular racial or ethnocultural identity)' },
  {
    value: 'white', label: 'White',
    children: [
      { value: 'african', label: 'African (e.g., South African)' },
      { value: 'caribbean', label: 'Caribbean (e.g., Cuban, Puerto Rican, Trinidadian)' },
      { value: 'european', label: 'European (e.g., British, French, Polish, Russian)' },
      { value: 'north_american', label: 'North American (e.g., American, Canadian)' },
      { value: 'south_american', label: 'South American (e.g., Argentinian, Chilean)' },
      { value: 'self_identify', label: 'Prefer to self-identify (please specify)', specify: true },
    ],
  },
  { value: 'not_listed', label: 'Another race and/or ethnicity not listed here (please specify)', specify: true },
  { value: PNA, label: 'Prefer not to answer', exclusive: true },
]

// ── Q6 Religion ─────────────────────────────────────────────────────────────
const RELIGION_OPTIONS = [
  { value: 'agnosticism', label: 'Agnosticism' },
  { value: 'atheism', label: 'Atheism' },
  { value: 'bahai', label: "Bahá'í Faith" },
  { value: 'buddhism', label: 'Buddhism' },
  { value: 'christianity', label: 'Christianity' },
  { value: 'confucianism', label: 'Confucianism' },
  { value: 'hinduism', label: 'Hinduism' },
  { value: 'humanism', label: 'Humanism' },
  { value: 'indigenous_spirituality', label: 'Indigenous Spirituality' },
  { value: 'islam', label: 'Islam' },
  { value: 'jainism', label: 'Jainism' },
  { value: 'judaism', label: 'Judaism' },
  { value: 'pantheism', label: 'Pantheism' },
  { value: 'sikhism', label: 'Sikhism' },
  { value: 'spiritual', label: 'Spiritual' },
  { value: 'unitarianism', label: 'Unitarianism' },
  { value: 'not_listed', label: 'My Religious, Spiritual Affiliations, or Belief is best described as (please specify)', specify: true },
  { value: PNA, label: 'Prefer not to answer', exclusive: true },
]

// ── Q7 Parental education ───────────────────────────────────────────────────
const PARENT_EDU_OPTIONS = [
  { value: 'less_than_high_school', label: 'Less than high school' },
  { value: 'high_school', label: 'Graduated high school' },
  { value: 'some_college', label: 'Attended College/CEGEP but did not earn a certificate, diploma or degree' },
  { value: 'some_university', label: 'Attended University but did not earn a degree' },
  { value: 'college_diploma', label: 'Completed a College/CEGEP certificate or diploma' },
  { value: 'bachelors', label: 'Bachelor’s Degree (e.g., BA, BSc, BEng, etc.)' },
  { value: 'professional', label: 'Professional Degree (e.g., Medicine, Law, Pharmacy, Dentistry, etc.)' },
  { value: 'masters', label: 'Master’s Degree' },
  { value: 'doctoral', label: 'Doctoral Degree' },
  { value: 'skilled_trades', label: 'Skilled trades' },
  { value: 'not_listed', label: 'A category not listed; may include non-traditional education from outside of Canada (please specify)', specify: true },
  { value: 'dont_know', label: 'Don’t know' },
  { value: PNA, label: 'Prefer not to answer' },
]

// ── Shared multi-select toggle logic ─────────────────────────────────────────
// Exclusive options ("prefer not to answer") clear everything else; selecting
// anything else clears the exclusive option.
function toggleMulti(options, selected, value) {
  const opt = options.find(o => o.value === value)
  if (selected.includes(value)) return selected.filter(v => v !== value)
  if (opt?.exclusive) return [value]
  return [...selected.filter(v => !options.find(o => o.value === v)?.exclusive), value]
}

export default function EquityCensusStep({ enrollment, scheduleId, onComplete, supabaseClient, isSimMode = false, previewMode = false }) {
  const db = supabaseClient ?? globalSupabase

  const [gender, setGender]               = useState([])
  const [trans, setTrans]                 = useState(null)
  const [orientation, setOrientation]     = useState([])
  const [disability, setDisability]       = useState(null)   // 'yes' | 'no' | PNA
  const [disabilityTypes, setDisabilityTypes] = useState([])
  const [indigenous, setIndigenous]       = useState(null)   // 'yes' | 'no' | PNA
  const [indigenousIds, setIndigenousIds] = useState([])
  const [racialized, setRacialized]       = useState(null)   // 'yes' | 'no' | 'not_sure' | PNA
  const [race, setRace]                   = useState([])     // parent keys + 'parent:child' keys
  const [religion, setReligion]           = useState([])
  const [parentEdu, setParentEdu]         = useState(null)
  const [specify, setSpecify]             = useState({})     // { fieldKey: text }
  const [feedback, setFeedback]           = useState('')
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState(null)

  function setSpecifyText(key, text) {
    setSpecify(prev => ({ ...prev, [key]: text }))
  }

  function buildResponses() {
    return {
      gender_identity:        gender,
      gender_identity_other:  gender.includes('not_listed') ? (specify.gender ?? '') : null,
      trans_identity:         trans,
      sexual_orientation:       orientation,
      sexual_orientation_other: orientation.includes('not_listed') ? (specify.orientation ?? '') : null,
      disability,
      disability_types:       disability === 'yes' ? disabilityTypes : [],
      disability_types_other: disability === 'yes' && disabilityTypes.includes('not_listed') ? (specify.disability ?? '') : null,
      indigenous,
      indigenous_identities:       indigenous === 'yes' ? indigenousIds : [],
      indigenous_identities_other: indigenous === 'yes' && indigenousIds.includes('not_listed') ? (specify.indigenous ?? '') : null,
      racialized,
      race_ethnicity: race,
      race_ethnicity_specify: Object.fromEntries(
        Object.entries(specify)
          .filter(([k]) => k.startsWith('race:') && race.includes(k.slice(5)))
          .map(([k, v]) => [k.slice(5), v])
      ),
      religion,
      religion_other: religion.includes('not_listed') ? (specify.religion ?? '') : null,
      parent_education:       parentEdu,
      parent_education_other: parentEdu === 'not_listed' ? (specify.parent_edu ?? '') : null,
      feedback: feedback.trim() || null,
    }
  }

  async function insertResponses(responses) {
    return db.from('equity_census_responses').insert({
      user_id:       enrollment?.profile_id ?? enrollment?.user_id ?? null,
      enrollment_id: enrollment?.id ?? null,
      schedule_id:   scheduleId ?? null,
      responses,
    })
  }

  // Sim mode: answer "prefer not to answer" throughout, then submit
  useEffect(() => {
    if (!isSimMode) return
    setGender([PNA]); setTrans(PNA); setOrientation([PNA])
    setDisability(PNA); setIndigenous(PNA); setRacialized(PNA)
    setRace([PNA]); setReligion([PNA]); setParentEdu(PNA)
    const t = setTimeout(async () => {
      if (!previewMode) {
        setSaving(true)
        const { error: dbErr } = await insertResponses({
          gender_identity: [PNA], gender_identity_other: null, trans_identity: PNA,
          sexual_orientation: [PNA], sexual_orientation_other: null,
          disability: PNA, disability_types: [], disability_types_other: null,
          indigenous: PNA, indigenous_identities: [], indigenous_identities_other: null,
          racialized: PNA, race_ethnicity: [PNA], race_ethnicity_specify: {},
          religion: [PNA], religion_other: null,
          parent_education: PNA, parent_education_other: null, feedback: null,
        })
        setSaving(false)
        if (dbErr) { console.error('sim equity census insert:', dbErr) }
      }
      onComplete({})
    }, 500)
    return () => clearTimeout(t)
  }, [isSimMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit =
    gender.length > 0 &&
    trans !== null &&
    orientation.length > 0 &&
    disability !== null &&
    (disability !== 'yes' || disabilityTypes.length > 0) &&
    indigenous !== null &&
    (indigenous !== 'yes' || indigenousIds.length > 0) &&
    racialized !== null &&
    race.length > 0 &&
    religion.length > 0 &&
    parentEdu !== null

  async function handleSubmit() {
    if (!canSubmit || saving) return
    if (previewMode) { onComplete({ preview: true, responses: buildResponses() }); return }
    setSaving(true)
    setError(null)
    const { error: dbErr } = await insertResponses(buildResponses())
    setSaving(false)
    if (dbErr) { setError('Could not save — please try again.'); console.error('equity census insert:', dbErr); return }
    onComplete({})
  }

  return (
    <div style={S.wrap}>
      <h1 style={S.title}>Student Equity Census</h1>
      <p style={S.sub}>
        These questions are drawn from the U of T Student Equity Census. All questions are required — if
        you do not wish to provide an answer for any question, you can select &ldquo;Prefer not to
        answer&rdquo;. This option is available on every question. Your responses are confidential.
      </p>

      {/* 1. Gender identity */}
      <div style={S.section}>
        <h2 style={S.qNum}>1. Gender Identity</h2>
        <label style={S.qLabel}>
          Please indicate which of the following terms best describes your gender identity. Check as many
          as apply. For select options, you may specify further below after selecting.
        </label>
        <CheckGroup
          options={GENDER_OPTIONS}
          selected={gender}
          onToggle={v => setGender(prev => toggleMulti(GENDER_OPTIONS, prev, v))}
          specifyText={specify.gender ?? ''}
          onSpecify={t => setSpecifyText('gender', t)}
        />

        <label style={{ ...S.qLabel, marginTop: 16 }}>
          Do you identify as trans or consider yourself to be a part of a trans community?
        </label>
        <p style={S.defBlock}>{TRANS_DEF}</p>
        <ButtonRow options={TRANS_OPTIONS} value={trans} onChange={setTrans} />
      </div>

      {/* 2. Sexual orientation */}
      <div style={S.section}>
        <h2 style={S.qNum}>2. Sexual Orientation</h2>
        <label style={S.qLabel}>
          Please indicate which of the following terms best describe your sexual orientation. Check as
          many as apply. For select options, you may specify further below after selecting.
        </label>
        <CheckGroup
          options={ORIENTATION_OPTIONS}
          selected={orientation}
          onToggle={v => setOrientation(prev => toggleMulti(ORIENTATION_OPTIONS, prev, v))}
          specifyText={specify.orientation ?? ''}
          onSpecify={t => setSpecifyText('orientation', t)}
        />
      </div>

      {/* 3. Disability */}
      <div style={S.section}>
        <h2 style={S.qNum}>3. Disability</h2>
        <label style={S.qLabel}>Do you identify as a person with a disability?</label>
        <p style={S.defBlock}>{DISABILITY_DEF}</p>
        <ButtonRow
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: PNA, label: 'Prefer not to answer' },
          ]}
          value={disability}
          onChange={setDisability}
        />
        {disability === 'yes' && (
          <>
            <label style={{ ...S.qLabel, marginTop: 12 }}>
              Please indicate which of the following best describe your disability/ies. Check as many as apply.
            </label>
            <CheckGroup
              options={DISABILITY_TYPE_OPTIONS}
              selected={disabilityTypes}
              onToggle={v => setDisabilityTypes(prev => toggleMulti(DISABILITY_TYPE_OPTIONS, prev, v))}
              specifyText={specify.disability ?? ''}
              onSpecify={t => setSpecifyText('disability', t)}
            />
          </>
        )}
      </div>

      {/* 4. Indigenous identity */}
      <div style={S.section}>
        <h2 style={S.qNum}>4. Indigenous Identity</h2>
        <label style={S.qLabel}>
          Do you identify as an Indigenous person from Turtle Island/North America? For example, First
          Nations (status or non-status), Inuk (Inuit), Métis, Alaska Native, Native American, Native
          Hawaiian or Native Mexican?
        </label>
        <ButtonRow
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: PNA, label: 'Prefer not to answer' },
          ]}
          value={indigenous}
          onChange={setIndigenous}
        />
        {indigenous === 'yes' && (
          <>
            <label style={{ ...S.qLabel, marginTop: 12 }}>
              Please check those that apply to you. Check as many as apply.
            </label>
            <CheckGroup
              options={INDIGENOUS_ID_OPTIONS}
              selected={indigenousIds}
              onToggle={v => setIndigenousIds(prev => toggleMulti(INDIGENOUS_ID_OPTIONS, prev, v))}
              specifyText={specify.indigenous ?? ''}
              onSpecify={t => setSpecifyText('indigenous', t)}
            />
          </>
        )}
      </div>

      {/* 5. Racial / ethnocultural identity */}
      <div style={S.section}>
        <h2 style={S.qNum}>5. Racial and/or Ethnocultural Identity</h2>
        <label style={S.qLabel}>Do you identify as a racialized person/person of colour?</label>
        <p style={S.defBlock}>{RACIALIZED_DEF}</p>
        <ButtonRow
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'not_sure', label: 'Not sure' },
            { value: PNA, label: 'Prefer not to answer' },
          ]}
          value={racialized}
          onChange={setRacialized}
        />

        <label style={{ ...S.qLabel, marginTop: 12 }}>
          Please indicate which of the following terms best describe your racial and/or ethnocultural
          identity. Check as many terms as apply.
        </label>
        <RaceGroup
          options={RACE_OPTIONS}
          selected={race}
          setSelected={setRace}
          specify={specify}
          onSpecify={setSpecifyText}
        />
      </div>

      {/* 6. Religion */}
      <div style={S.section}>
        <h2 style={S.qNum}>6. Religious, Spiritual Affiliations or Beliefs</h2>
        <label style={S.qLabel}>
          Which of the following best reflect your religious identity, spiritual traditions or beliefs?
          Check as many as apply.
        </label>
        <CheckGroup
          options={RELIGION_OPTIONS}
          selected={religion}
          onToggle={v => setReligion(prev => toggleMulti(RELIGION_OPTIONS, prev, v))}
          specifyText={specify.religion ?? ''}
          onSpecify={t => setSpecifyText('religion', t)}
        />
      </div>

      {/* 7. Parental education */}
      <div style={S.section}>
        <h2 style={S.qNum}>7. Educational Attainment of Parents or Guardians</h2>
        <label style={S.qLabel}>
          What is the highest level of formal education of your most highly educated parent or guardian?
        </label>
        <div style={S.radioCol}>
          {PARENT_EDU_OPTIONS.map(opt => (
            <div key={opt.value}>
              <label style={S.checkRow}>
                <input
                  type="radio"
                  name="parent_edu"
                  checked={parentEdu === opt.value}
                  onChange={() => setParentEdu(opt.value)}
                  style={S.checkInput}
                />
                <span style={S.checkLabel}>{opt.label}</span>
              </label>
              {opt.specify && parentEdu === opt.value && (
                <input
                  type="text"
                  value={specify.parent_edu ?? ''}
                  onChange={e => setSpecifyText('parent_edu', e.target.value)}
                  placeholder="Please specify…"
                  style={S.specifyInput}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 8. Feedback */}
      <div style={S.section}>
        <h2 style={S.qNum}>8. Feedback <span style={S.optional}>(optional)</span></h2>
        <label style={S.qLabel}>
          To assist us in our review of this data collection, please share any comments about the
          questions or this process with us here. We appreciate your feedback as we work to collect
          accurate and inclusive demographic information.
        </label>
        <textarea
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          rows={4}
          style={S.textarea}
        />
      </div>

      {error && <p style={S.error}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || saving}
        style={{ ...S.submitBtn, opacity: canSubmit && !saving ? 1 : 0.4, cursor: canSubmit && !saving ? 'pointer' : 'default' }}
      >
        {saving ? 'Saving…' : 'Continue →'}
      </button>
      {!canSubmit && (
        <p style={S.hint}>All questions are required — choose &ldquo;Prefer not to answer&rdquo; on any you wish to skip.</p>
      )}
    </div>
  )
}

// ── Multi-select checkbox group with optional definitions + specify boxes ────
function CheckGroup({ options, selected, onToggle, specifyText, onSpecify }) {
  return (
    <div style={S.radioCol}>
      {options.map(opt => (
        <div key={opt.value}>
          <label style={S.checkRow}>
            <input
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={() => onToggle(opt.value)}
              style={S.checkInput}
            />
            <span style={S.checkLabel}>
              {opt.label}
              {opt.def && <span style={S.defText}>{opt.def}</span>}
            </span>
          </label>
          {opt.specify && selected.includes(opt.value) && (
            <input
              type="text"
              value={specifyText}
              onChange={e => onSpecify(e.target.value)}
              placeholder="Please specify…"
              style={S.specifyInput}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Single-select button row (matches DemographicsStep style) ────────────────
function ButtonRow({ options, value, onChange }) {
  return (
    <div style={S.optionRow}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{ ...S.optBtn, ...(value === opt.value ? S.optBtnSel : {}) }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Hierarchical race/ethnocultural group ────────────────────────────────────
// Parent checkboxes reveal sub-option checkboxes; children stored as
// "parent:child". Deselecting a parent removes its children.
function RaceGroup({ options, selected, setSelected, specify, onSpecify }) {
  function toggleParent(opt) {
    setSelected(prev => {
      if (prev.includes(opt.value)) {
        return prev.filter(v => v !== opt.value && !v.startsWith(opt.value + ':'))
      }
      if (opt.exclusive) return [opt.value]
      return [...prev.filter(v => v !== PNA), opt.value]
    })
  }
  function toggleChild(parent, child) {
    const key = `${parent.value}:${child.value}`
    setSelected(prev => prev.includes(key) ? prev.filter(v => v !== key) : [...prev, key])
  }

  return (
    <div style={S.radioCol}>
      {options.map(opt => (
        <div key={opt.value}>
          <label style={S.checkRow}>
            <input
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={() => toggleParent(opt)}
              style={S.checkInput}
            />
            <span style={{ ...S.checkLabel, fontWeight: opt.children ? 600 : 400 }}>{opt.label}</span>
          </label>
          {opt.specify && selected.includes(opt.value) && (
            <input
              type="text"
              value={specify[`race:${opt.value}`] ?? ''}
              onChange={e => onSpecify(`race:${opt.value}`, e.target.value)}
              placeholder="Please specify…"
              style={S.specifyInput}
            />
          )}
          {opt.children && selected.includes(opt.value) && (
            <div style={S.childCol}>
              {opt.children.map(child => {
                const key = `${opt.value}:${child.value}`
                return (
                  <div key={child.value}>
                    <label style={S.checkRow}>
                      <input
                        type="checkbox"
                        checked={selected.includes(key)}
                        onChange={() => toggleChild(opt, child)}
                        style={S.checkInput}
                      />
                      <span style={S.checkLabel}>{child.label}</span>
                    </label>
                    {child.specify && selected.includes(key) && (
                      <input
                        type="text"
                        value={specify[`race:${key}`] ?? ''}
                        onChange={e => onSpecify(`race:${key}`, e.target.value)}
                        placeholder="Please specify…"
                        style={S.specifyInput}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const S = {
  wrap: {
    maxWidth: 640,
    margin: '0 auto',
    padding: '40px 24px 80px',
    display: 'flex',
    flexDirection: 'column',
    gap: 44,
    fontFamily: '"DM Sans",system-ui,sans-serif',
  },
  title: {
    fontFamily: '"DM Serif Display",Georgia,serif',
    fontSize: 32, fontWeight: 400, color: 'var(--tx)', margin: 0,
  },
  sub: { fontSize: 14, color: 'var(--tx2)', margin: 0, lineHeight: 1.6 },

  section: { display: 'flex', flexDirection: 'column', gap: 12 },
  qNum: {
    fontFamily: '"DM Serif Display",Georgia,serif',
    fontSize: 21, fontWeight: 400, color: 'var(--tx)', margin: 0,
  },
  optional: { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 13, color: 'var(--tx3)' },
  qLabel: { fontSize: 15, fontWeight: 600, color: 'var(--tx)', lineHeight: 1.5 },
  defBlock: {
    fontSize: 13, color: 'var(--tx2)', lineHeight: 1.6, margin: 0,
    background: '#faf7fb', border: '1px solid var(--bd)', borderRadius: 10, padding: '12px 14px',
  },

  radioCol: { display: 'flex', flexDirection: 'column', gap: 4 },
  childCol: {
    display: 'flex', flexDirection: 'column', gap: 4,
    marginLeft: 28, paddingLeft: 12, borderLeft: '2px solid var(--bd)',
  },
  checkRow: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
  },
  checkInput: { accentColor: 'var(--pk)', marginTop: 3, flexShrink: 0, cursor: 'pointer' },
  checkLabel: { fontSize: 14, color: 'var(--tx)', lineHeight: 1.5 },
  defText: {
    display: 'block', fontSize: 12.5, color: 'var(--tx3)', lineHeight: 1.55, marginTop: 2,
  },
  specifyInput: {
    display: 'block', width: '100%', maxWidth: 420, boxSizing: 'border-box',
    margin: '4px 0 6px 30px', padding: '8px 12px',
    border: '1px solid var(--bd)', borderRadius: 8,
    fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 14, color: 'var(--tx)',
    background: '#fff', outline: 'none',
  },

  optionRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  optBtn: {
    padding: '10px 20px', borderRadius: 10,
    border: '1px solid var(--bd)', background: '#fff',
    fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 14, color: 'var(--tx2)',
    cursor: 'pointer', transition: 'all 0.12s',
  },
  optBtnSel: {
    background: 'var(--pkb)', color: 'var(--pk)',
    border: '1px solid var(--pk)', fontWeight: 600,
  },

  textarea: {
    width: '100%', boxSizing: 'border-box', padding: '10px 14px',
    border: '1px solid var(--bd)', borderRadius: 10, resize: 'vertical',
    fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 14, color: 'var(--tx)',
    background: '#fff', outline: 'none', lineHeight: 1.6,
  },

  submitBtn: {
    alignSelf: 'flex-start',
    background: 'var(--pk)', color: '#fff', border: 'none',
    borderRadius: 10, padding: '13px 32px',
    fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 16, fontWeight: 600,
    transition: 'opacity 0.15s',
  },
  hint: { fontSize: 13, color: 'var(--tx3)', margin: '-30px 0 0', lineHeight: 1.5 },
  error: { fontSize: 14, color: '#dc2626', margin: 0 },
}
