// Builds the three new questionnaire definitions for Maya's study (WP-I1).
// Text is verbatim from Ethics/source_markdown/07_Questionnaire_Packet.md and 06 (Screen 11).
import { writeFileSync } from 'node:fs'

const out = process.argv[2]

// ---- BFI-2 NE + OM (24 items, packet order = original relative order) ----
const bfiPacket = [
  'Is relaxed, handles stress well.', 'Has few artistic interests.',
  'Stays optimistic after experiencing a setback.', 'Is curious about many different things.',
  'Is moody, has up and down mood swings.', 'Is inventive, finds clever ways to do things.',
  'Can be tense.', 'Is fascinated by art, music, or literature.',
  'Feels secure, comfortable with self.', 'Avoids intellectual, philosophical discussions.',
  'Is emotionally stable, not easily upset.', 'Has little creativity.',
  'Worries a lot.', 'Values art and beauty.',
  'Often feels sad.', 'Is complex, a deep thinker.',
  'Keeps their emotions under control.', 'Has difficulty imagining things.',
  'Rarely feels anxious or afraid.', 'Thinks poetry and plays are boring.',
  'Tends to feel depressed, blue.', 'Has little interest in abstract ideas.',
  'Is temperamental, gets emotional easily.', 'Is original, comes up with new ideas.',
]
// packet n (1-based): odd -> NE item 4 + 5*((n-1)/2); even -> OM item 5*(n/2)
const bfiId = n => {
  const orig = n % 2 === 1 ? 4 + 5 * ((n - 1) / 2) : 5 * (n / 2)
  return `bfi2_${String(orig).padStart(2, '0')}`
}
const P = ns => ns.map(bfiId)
const bfiScale = [
  { label: 'Disagree strongly', value: 1 }, { label: 'Disagree a little', value: 2 },
  { label: 'Neutral; no opinion', value: 3 }, { label: 'Agree a little', value: 4 },
  { label: 'Agree strongly', value: 5 },
]
const lower = s => s[0].toLowerCase() + s.slice(1)
const bfiItems = bfiPacket.map((text, i) => ({
  id: bfiId(i + 1), type: 'likert', scale: bfiScale,
  question: `I am someone who… ${lower(text)}`, required: true, allow_pna: true,
}))
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))

const bfi = {
  name: 'Characteristics',
  slug: 'bfi2-ne-om',
  questionnaire_type: 'composable',
  instructions: 'Here are a number of characteristics that may or may not apply to you. For example, do you agree that you are someone who likes to spend time with others? Please write a number next to each statement to indicate the extent to which you agree or disagree with that statement.',
  pages: chunk(bfiItems, 6).map((components, i) => ({ id: `bfi_p${i + 1}`, components })),
  scoring: {
    method: 'mean',
    note: 'Soto & John (2017), BFI-2 Negative Emotionality and Open-Mindedness domains (24 items). Item ids keep the original 60-item BFI-2 numbering, so the Open-Mindedness items match sf2-bfi2-om. Reverse-keyed items are recoded 6 - x; Prefer not to answer is scored as missing. Domain = mean of 12 items, facet = mean of 4.',
    reverse_items: P([1, 3, 9, 11, 17, 19, 2, 10, 12, 18, 20, 22]),
    subscales: [
      { name: 'Negative Emotionality', item_ids: P([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23]) },
      { name: 'Anxiety', item_ids: P([1, 7, 13, 19]) },
      { name: 'Depression', item_ids: P([3, 9, 15, 21]) },
      { name: 'Emotional Volatility', item_ids: P([5, 11, 17, 23]) },
      { name: 'Open-Mindedness', item_ids: P([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]) },
      { name: 'Aesthetic Sensitivity', item_ids: P([2, 8, 14, 20]) },
      { name: 'Intellectual Curiosity', item_ids: P([4, 10, 16, 22]) },
      { name: 'Creative Imagination', item_ids: P([6, 12, 18, 24]) },
    ],
  },
}

// ---- ASI-3 (18 items) ----
const asiText = [
  'It is important for me not to appear nervous.',
  'When I cannot keep my mind on a task, I worry that I might be going crazy.',
  'It scares me when my heart beats rapidly.',
  'When my stomach is upset, I worry that I might be seriously ill.',
  'It scares me when I am unable to keep my mind on a task.',
  'When I tremble in the presence of others, I fear what people might think of me.',
  "When my chest feels tight, I get scared that I won't be able to breathe properly.",
  "When I feel pain in my chest, I worry that I'm going to have a heart attack.",
  'I worry that other people will notice my anxiety.',
  'When I feel "spacey" or spaced out I worry that I may be mentally ill.',
  'It scares me when I blush in front of people.',
  'When I notice my heart skipping a beat, I worry that there is something seriously wrong with me.',
  'When I begin to sweat in a social situation, I fear people will think negatively of me.',
  'When my thoughts seem to speed up, I worry that I might be going crazy.',
  'When my throat feels tight, I worry that I could choke to death.',
  'When I have trouble thinking clearly, I worry that there is something wrong with me.',
  'I think it would be horrible for me to faint in public.',
  'When my mind goes blank, I worry there is something terribly wrong with me.',
]
const asiScale = [
  { label: '0 Very little', value: 0 }, { label: '1 A little', value: 1 }, { label: '2 Some', value: 2 },
  { label: '3 Much', value: 3 }, { label: '4 Very much', value: 4 },
]
const aId = n => `asi_${String(n).padStart(2, '0')}`
const asiItems = asiText.map((question, i) => ({
  id: aId(i + 1), type: 'likert', scale: asiScale, question, required: true, allow_pna: true,
}))
const asi = {
  name: 'Body sensations',
  slug: 'asi-3',
  questionnaire_type: 'composable',
  instructions: 'Enter the number from the scale below that best describes how typical or characteristic each item is of you, putting the number next to the item. You should make your ratings in terms of how much you agree or disagree with the statement as a general description of yourself.',
  pages: chunk(asiItems, 6).map((components, i) => ({ id: `asi_p${i + 1}`, components })),
  scoring: {
    method: 'sum',
    range: '0-72',
    source: 'ASI-3, Taylor et al. (2007). Items 0-4, none reverse-keyed. Total = sum of 18 (0-72); subscales are sums (0-24). Ids match sf2b-asi3-pc for the six Physical Concerns items. Prefer not to answer is scored as missing.',
    reverse_items: [],
    subscales: [
      { name: 'Physical Concerns', item_ids: [3, 4, 7, 8, 12, 15].map(aId) },
      { name: 'Cognitive Concerns', item_ids: [2, 5, 10, 14, 16, 18].map(aId) },
      { name: 'Social Concerns', item_ids: [1, 6, 9, 11, 13, 17].map(aId) },
    ],
  },
}

// ---- Strategy helpfulness (Screen 11) ----
const seven = (lo, hi) => [1, 2, 3, 4, 5, 6, 7].map(v => ({ value: v, label: v === 1 ? lo : v === 7 ? hi : '' }))
const help = {
  name: 'Final questions',
  slug: 'bre-helpfulness',
  questionnaire_type: 'composable',
  instructions: 'Almost done. Please answer a few last questions about the breathing approach you used.',
  pages: [{
    id: 'help_p1',
    components: [
      { id: 'bre_help_rating', type: 'likert', required: true, scale: seven('Not at all helpful', 'Extremely helpful'),
        question: 'How helpful was this strategy for dealing with the feelings the clips brought up?' },
      { id: 'bre_help_why', type: 'open_text', required: false, multiline: true, rows: 4, placeholder: '', max_words: null, min_words: null,
        question: 'What, if anything, made it helpful or unhelpful?' },
      { id: 'bre_help_alt', type: 'open_text', required: false, multiline: true, rows: 4, placeholder: '', max_words: null, min_words: null,
        question: 'Is there another strategy you think would have worked better for you?' },
    ],
  }],
  scoring: { method: 'none', note: 'bre_help_rating is a single item (1-7); the two open-text answers are coded qualitatively.' },
}

writeFileSync(out, JSON.stringify({ bfi, asi, help }, null, 2))
console.log(bfi.pages.map(p => p.components.map(c => c.id).join(',')).join('\n'))
console.log(asi.pages.length, 'asi pages')
