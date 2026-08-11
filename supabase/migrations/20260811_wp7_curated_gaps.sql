-- WP7 item-format audit — curated gaps
--
-- Six holes found by writing exam items against the guide and checking whether the
-- locked study text can actually answer them (run plan §39.10). All six sit in sections
-- that already contain prose, so extract_page_needs() reads them as filled and
-- populate_page_gaps() will never derive them — they have to be curated in.
--
-- kind='curated' is used here for the first time. It is the staff-flagging route described
-- in WP6 Phase D: a gap recorded against the page without touching page content, so no flag
-- ever passes through provenance. populate_page_gaps() is unaffected — it only writes
-- 'annotation' and 'empty_section' rows, and never deletes.
--
-- ask_hash follows the function's own convention for prose asks: md5(lower(ask)).
-- Idempotent: ON CONFLICT (page_id, ask_hash) DO NOTHING.

insert into page_gaps (course_id, page_id, slug, kind, section, ask, ask_hash, tier, difficulty, capacity, notes)
select
  p.course_id,
  p.id,
  p.slug,
  'curated',
  v.section,
  v.ask,
  md5(lower(v.ask)),
  d.tier,
  v.difficulty,
  v.capacity,
  'Added 2026-08-11 by the WP7 item-format audit (run plan §39.10): exam items were written against this page and the locked text could not answer them.'
from (values

  -- Q1D. Antipsychotics are explained by dopamine action in Treatment, but the mechanism
  -- is never stated in Etiology. The spectrum page carries only a one-line stub.
  ('schizophrenia',
   'etiology',
   'the dopamine hypothesis — the neurochemical account of positive symptoms. This page''s neurobiological material is structural only (reduced volume, ventricular enlargement, medial temporal and orbitofrontal reductions), and [[psychosis-and-the-schizophrenia-spectrum]] carries only the stub sentence "Dopaminergic accounts, which the treatment section below depends on". The treatment section explains antipsychotic action by dopamine, so the mechanism is assumed throughout the chapter and stated nowhere in it.',
   'green', 2),

  -- Q1E. The imaging findings are cross-sectional; nothing licenses a claim about change over time.
  ('schizophrenia',
   'etiology',
   'whether the structural brain findings change over the course of the illness. The neuroimaging results on this page are cross-sectional group differences against healthy controls; no source in this corpus reports longitudinal change, so the corpus cannot currently support any claim about progressive brain change or about what distinguishes early from late illness neurobiologically.',
   'amber', 1),

  -- Q1C. Two pages each hold half of the phase/symptom story and neither joins them.
  ('positive-and-negative-symptoms',
   'why-the-distinction-has-prognostic-teeth',
   'how the positive/negative distinction maps onto the prodromal, active and residual phases. This page states that negative symptoms often appear before positive symptoms and remain after they remit; [[schizophrenia]] describes the prodromal, active and residual phases separately. Neither page joins the two, so the widely taught claim that positive symptoms dominate the acute phase while negative symptoms dominate before and after it is not supported anywhere in the corpus — and the one sentence that does connect them reads the other way.',
   'amber', 1),

  -- Q2C/Q2D. The page's positive-reinforcement account cannot explain continued use as pleasure falls.
  ('brain-reward-system',
   'the-model',
   'the neuroadaptation account of sustained use — tolerance-related change in reward response, and the incentive-sensitisation (wanting versus liking) distinction. This page carries only a positive-reinforcement model in which the substance is pleasurable and that pleasure reinforces use. That model cannot explain continued use as subjective pleasure declines, and as written it reads as support for the folk view that addiction is pleasure-seeking — the misconception the course sets out to correct.',
   'green', 2),

  -- Q2D. The page says this itself, in prose the extractor cannot see.
  ('brain-reward-system',
   'what-is-missing',
   'human imaging, lesion or neurochemical evidence for the reward account. This page states plainly that none is cited and that the model is asserted at textbook level; one well-chosen human study would let the page make a claim it currently cannot, and would give the chapter something to set against its own caution about the source''s internally inconsistent directional statements.',
   'amber', 1),

  -- Q4. Tarasoff and Smith v. Jones are third-party doctrines. The self-harm case is absent.
  ('law-and-ethics',
   'confidentiality-privileged-communication-and-the-duty-to-warn',
   'the clinician''s obligations where the risk is to the patient rather than to a third party. This section covers Tarasoff and Smith v. Jones, both of which concern protecting others from the patient; neither this page nor [[suicide-and-self-harm]] states what confidentiality obligations apply when a competent patient discloses suicidal intent, what factors bear on breaching, or the Ontario mechanism for acting on it. Staff-only: this is provincial statute, and the corpus has already been wrong once about a statutory age threshold.',
   'red', 1)

) as v(slug, section, ask, difficulty, capacity)
join wiki_pages p
  on p.slug = v.slug
 and p.course_id = '35e9842a-51a5-4f1e-aa5f-3a52f938196f'
left join disorders d
  on d.slug = v.slug
on conflict (page_id, ask_hash) do nothing;
