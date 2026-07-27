-- 20260725_academic_wiki_wp3.sql
-- WP3 of the PSY240 Field Guide wiki (docs/markdowns/psy240_wiki_plan.md §4).
--
-- TARGET: the separate `radlab-academic` Supabase project.
-- Builds on 20260724_academic_init.sql and 20260725_academic_wiki_schema.sql.
--
-- Two things:
--   1. The taxonomy seed — 123 catalog rows from psy240_taxonomy.md §6.
--   2. The review path — review_proposal(), the RPC that promotes a pending
--      proposal into accepted page content.
--
-- Deliberately NOT here: authenticated write policies on wiki_pages. The
-- review RPC is SECURITY DEFINER and checks staff enrollment itself, so the
-- tables stay service-role/RPC-only. That keeps the write surface one audited
-- function instead of a broad UPDATE grant, matching the narrow SECURITY
-- DEFINER pattern already used elsewhere in the platform (get_class_participation,
-- verify_class_email).

-- =====================================================================
-- 1. TAXONOMY SEED — 123 rows
-- =====================================================================
-- Source of truth: docs/markdowns/psy240_taxonomy.md §6. Composition:
--   9 foundations + 16 topic overviews + 46 Tier A + 52 Tier B = 123.
-- Tier A/overview/foundation (71 rows) are generated with a source bundle in
-- WP4; Tier B (52) are mechanical stubs. `lecture` is the course lecture the
-- page is taught in (1-11), used to generate lecture pages' link lists.
--
-- Chapter 14 (Gender Dysphoria) has no overview row: a one-disorder chapter
-- needs one page. Chapters 11 and 20 have no rows at all — not taught.
-- The mood overview covers DSM chapters 3 AND 4, which the course teaches as
-- one block; it is filed under 3 and flagged in tier_review_note.
--
-- Idempotent: ON CONFLICT DO NOTHING on (course_id, slug), so re-running is
-- safe and will not clobber later edits.

insert into public.disorders (course_id, slug, title, dsm_chapter, tier, lecture, tier_review_note)
select c.id, v.slug, v.title, v.chapter, v.tier, v.lecture, v.note
from public.courses c,
(values
  -- ── Foundations (9) ───────────────────────────────────────────────
  ('what-is-abnormal','What "abnormal" means',null,'foundation',1,null),
  ('historical-traditions','Historical traditions in psychopathology',null,'foundation',1,null),
  ('integrative-model','The integrative model',null,'foundation',1,'taught across L1-L2'),
  ('models-of-psychopathology','Models of psychopathology',null,'foundation',1,'taught across L1-L2'),
  ('clinical-assessment','Clinical assessment',null,'foundation',2,null),
  ('diagnosis-and-classification','Diagnosis and classification',null,'foundation',2,null),
  ('research-methods','Research methods in psychopathology',null,'foundation',2,null),
  ('suicide-and-self-harm','Suicide and self-harm',null,'foundation',6,'transdiagnostic anchor; taught in the L6 block'),
  ('law-and-ethics','Mental health, the law, and professional ethics',null,'foundation',11,'deliberately one page: the deck teaches law and ethics as one block'),

  -- ── 1. Neurodevelopmental (L10) ───────────────────────────────────
  ('neurodevelopmental-disorders','Neurodevelopmental disorders',1,'overview',10,null),
  ('adhd','Attention-deficit/hyperactivity disorder',1,'A',10,null),
  ('autism-spectrum-disorder','Autism spectrum disorder',1,'A',10,null),
  ('intellectual-developmental-disorder','Intellectual developmental disorder',1,'A',10,null),
  ('specific-learning-disorder','Specific learning disorder',1,'A',10,null),
  ('tic-disorders','Tic disorders / Tourette''s disorder',1,'B',3,'named in L3 alongside OCD, taught in L10'),
  ('communication-disorders','Communication disorders',1,'B',10,null),

  -- ── 2. Schizophrenia spectrum (L9) ────────────────────────────────
  ('psychosis-and-the-schizophrenia-spectrum','Psychosis and the schizophrenia spectrum',2,'overview',9,null),
  ('schizophrenia','Schizophrenia',2,'A',9,null),
  ('delusional-disorder','Delusional disorder',2,'A',9,null),
  ('schizoaffective-disorder','Schizoaffective disorder',2,'B',9,'close call - could be Tier A'),
  ('schizophreniform-disorder','Schizophreniform disorder',2,'B',9,null),
  ('brief-psychotic-disorder','Brief psychotic disorder',2,'B',9,null),

  -- ── 3-4. Mood: bipolar + depressive (L5) ──────────────────────────
  ('mood-disorders','Mood disorders',3,'overview',5,'shared overview for DSM chapters 3 AND 4; L5 teaches them as one block'),
  ('bipolar-i-disorder','Bipolar I disorder',3,'A',5,null),
  ('bipolar-ii-disorder','Bipolar II disorder',3,'A',5,null),
  ('cyclothymic-disorder','Cyclothymic disorder',3,'B',5,null),
  ('major-depressive-disorder','Major depressive disorder',4,'A',5,null),
  ('persistent-depressive-disorder','Persistent depressive disorder',4,'A',5,null),
  ('premenstrual-dysphoric-disorder','Premenstrual dysphoric disorder',4,'B',5,null),
  ('disruptive-mood-dysregulation-disorder','Disruptive mood dysregulation disorder',4,'B',5,null),

  -- ── 5. Anxiety (L3) ───────────────────────────────────────────────
  ('anxiety-disorders','Anxiety disorders',5,'overview',3,null),
  ('generalized-anxiety-disorder','Generalized anxiety disorder',5,'A',3,null),
  ('panic-disorder-and-agoraphobia','Panic disorder and agoraphobia',5,'A',3,'one page: L3 teaches interoceptive avoidance as one causal story across both'),
  ('specific-phobia','Specific phobia',5,'A',3,null),
  ('social-anxiety-disorder','Social anxiety disorder',5,'A',3,null),
  ('separation-anxiety-disorder','Separation anxiety disorder',5,'B',3,null),
  ('selective-mutism','Selective mutism',5,'B',3,null),

  -- ── 6. Obsessive-compulsive and related (L3, recapped L4) ─────────
  ('obsessive-compulsive-and-related-disorders','Obsessive-compulsive and related disorders',6,'overview',3,null),
  ('obsessive-compulsive-disorder','Obsessive-compulsive disorder',6,'A',3,null),
  ('body-dysmorphic-disorder','Body dysmorphic disorder',6,'A',3,null),
  ('hoarding-disorder','Hoarding disorder',6,'B',3,'close call - could be Tier A'),
  ('trichotillomania','Trichotillomania (hair-pulling disorder)',6,'B',3,null),
  ('excoriation-disorder','Excoriation (skin-picking) disorder',6,'B',3,null),

  -- ── 7. Trauma- and stressor-related (L4) ──────────────────────────
  ('trauma-and-stressor-related-disorders','Trauma- and stressor-related disorders',7,'overview',4,null),
  ('posttraumatic-stress-disorder','Posttraumatic stress disorder',7,'A',4,null),
  ('adjustment-disorders','Adjustment disorders',7,'A',4,null),
  ('acute-stress-disorder','Acute stress disorder',7,'B',4,null),
  ('prolonged-grief-disorder','Prolonged grief disorder',7,'B',4,'close call - could be Tier A'),
  ('reactive-attachment-disorder','Reactive attachment disorder',7,'B',4,'also taught in L10 attachment block'),
  ('disinhibited-social-engagement-disorder','Disinhibited social engagement disorder',7,'B',4,'also taught in L10 attachment block'),

  -- ── 8. Dissociative (L4) ──────────────────────────────────────────
  ('dissociative-disorders','Dissociative disorders',8,'overview',4,null),
  ('dissociative-identity-disorder','Dissociative identity disorder',8,'A',4,null),
  ('dissociative-amnesia','Dissociative amnesia',8,'A',4,'includes the fugue specifier'),
  ('depersonalization-derealization-disorder','Depersonalization/derealization disorder',8,'B',4,null),

  -- ── 9. Somatic symptom and related (L3) ───────────────────────────
  ('somatic-symptom-and-related-disorders','Somatic symptom and related disorders',9,'overview',3,null),
  ('somatic-symptom-disorder','Somatic symptom disorder',9,'A',3,null),
  ('illness-anxiety-disorder','Illness anxiety disorder',9,'A',3,null),
  ('functional-neurological-symptom-disorder','Functional neurological symptom disorder (conversion disorder)',9,'A',3,'Tier A despite low prevalence: it is the worked case in L8 case-study coaching'),
  ('factitious-disorder','Factitious disorder',9,'B',3,'includes imposed on another; malingering noted here as a non-diagnosis'),
  ('psychological-factors-affecting-other-medical-conditions','Psychological factors affecting other medical conditions',9,'B',3,null),

  -- ── 10. Feeding and eating (L6) ───────────────────────────────────
  ('feeding-and-eating-disorders','Feeding and eating disorders',10,'overview',6,null),
  ('anorexia-nervosa','Anorexia nervosa',10,'A',6,null),
  ('bulimia-nervosa','Bulimia nervosa',10,'A',6,null),
  ('binge-eating-disorder','Binge-eating disorder',10,'A',6,null),
  ('avoidant-restrictive-food-intake-disorder','Avoidant/restrictive food intake disorder',10,'B',6,null),

  -- ── 12. Sleep-wake (L6) ───────────────────────────────────────────
  ('sleep-wake-disorders','Sleep-wake disorders',12,'overview',6,null),
  ('insomnia-disorder','Insomnia disorder',12,'A',6,null),
  ('narcolepsy','Narcolepsy',12,'A',6,null),
  ('obstructive-sleep-apnea-hypopnea','Obstructive sleep apnea hypopnea',12,'B',6,'close call - could be Tier A; covers central apnea + sleep-related hypoventilation'),
  ('hypersomnolence-disorder','Hypersomnolence disorder',12,'B',6,null),
  ('circadian-rhythm-sleep-wake-disorders','Circadian rhythm sleep-wake disorders',12,'B',6,null),
  ('parasomnias','Parasomnias',12,'B',6,'one page: NREM arousal disorders, nightmare disorder, REM sleep behaviour disorder'),

  -- ── 13. Sexual dysfunctions (L7) ──────────────────────────────────
  ('sexual-dysfunctions','Sexual dysfunctions',13,'overview',7,null),
  ('erectile-disorder','Erectile disorder',13,'A',7,null),
  ('female-sexual-interest-arousal-disorder','Female sexual interest/arousal disorder',13,'A',7,null),
  ('genito-pelvic-pain-penetration-disorder','Genito-pelvic pain/penetration disorder',13,'B',7,'close call - could be Tier A'),
  ('ejaculation-and-orgasmic-disorders','Ejaculation and orgasmic disorders',13,'B',7,'one page: early/delayed ejaculation + female orgasmic disorder'),
  ('male-hypoactive-sexual-desire-disorder','Male hypoactive sexual desire disorder',13,'B',7,null),

  -- ── 14. Gender dysphoria (L7) — single page, no overview ──────────
  ('gender-dysphoria','Gender dysphoria',14,'A',7,'REWRITE-LEVEL REVIEW (~30 min, not 15): the 2025 deck carries dated terminology alongside current material and must not be laundered into a reference page'),

  -- ── 15. Disruptive, impulse-control, and conduct (L8 + L10) ───────
  ('disruptive-impulse-control-and-conduct-disorders','Disruptive, impulse-control, and conduct disorders',15,'overview',8,null),
  ('conduct-disorder','Conduct disorder',15,'A',10,'taught in the L10 developmental block'),
  ('oppositional-defiant-disorder','Oppositional defiant disorder',15,'A',10,'taught in the L10 developmental block'),
  ('intermittent-explosive-disorder','Intermittent explosive disorder',15,'B',8,'close call - could be Tier A'),
  ('kleptomania','Kleptomania',15,'B',8,null),
  ('pyromania','Pyromania',15,'B',8,null),

  -- ── 16. Substance-related and addictive (L8) ──────────────────────
  ('substance-related-and-addictive-disorders','Substance-related and addictive disorders',16,'overview',8,null),
  ('alcohol-use-disorder','Alcohol use disorder',16,'A',8,'includes DTs and fetal alcohol syndrome'),
  ('opioid-use-disorder','Opioid use disorder',16,'A',8,'includes the Canadian opioid crisis'),
  ('stimulant-use-disorder','Stimulant use disorder',16,'A',8,'amphetamines, MDMA, cocaine'),
  ('cannabis-related-disorders','Cannabis-related disorders',16,'A',8,'includes 2018 legalization'),
  ('gambling-disorder','Gambling disorder',16,'A',8,null),
  ('tobacco-use-disorder','Tobacco use disorder',16,'B',8,'Tier B only because nicotine gets less lecture time than its public-health weight deserves; first candidate for promotion'),
  ('sedative-hypnotic-anxiolytic-related-disorders','Sedative-, hypnotic-, or anxiolytic-related disorders',16,'B',8,null),
  ('caffeine-related-disorders','Caffeine-related disorders',16,'B',8,null),
  ('hallucinogen-related-disorders','Hallucinogen-related disorders',16,'B',8,'LSD, psilocybin, PCP'),
  ('inhalant-use-disorder','Inhalant use disorder',16,'B',8,'plus steroids and designer drugs'),

  -- ── 17. Neurocognitive (L10) ──────────────────────────────────────
  ('neurocognitive-disorders','Neurocognitive disorders',17,'overview',10,null),
  ('delirium','Delirium',17,'A',10,null),
  ('alzheimers-disease-ncd','Major/mild NCD due to Alzheimer''s disease',17,'A',10,null),
  ('vascular-ncd','Major/mild vascular NCD',17,'A',10,null),
  ('traumatic-brain-injury-ncd','Major/mild NCD due to traumatic brain injury',17,'B',10,'close call - could be Tier A'),
  ('frontotemporal-ncd','Frontotemporal NCD (Pick''s disease)',17,'B',10,null),
  ('ncd-with-lewy-bodies','NCD with Lewy bodies',17,'B',10,null),
  ('substance-medication-induced-ncd','Substance/medication-induced NCD',17,'B',10,null),
  ('ncd-other-aetiologies','NCD due to Parkinson''s, Huntington''s, HIV infection, and prion disease',17,'B',10,'one page for four aetiologies: each gets a single slide, and four stubs would be worse than one comparison'),

  -- ── 18. Personality (L11) ─────────────────────────────────────────
  ('personality-disorders','Personality disorders',18,'overview',11,null),
  ('borderline-personality-disorder','Borderline personality disorder',18,'A',11,'includes DBT'),
  ('antisocial-personality-disorder','Antisocial personality disorder',18,'A',11,'includes psychopathy, underarousal and fearlessness hypotheses'),
  ('schizotypal-personality-disorder','Schizotypal personality disorder',18,'A',11,'cross-linked from the schizophrenia spectrum'),
  ('narcissistic-personality-disorder','Narcissistic personality disorder',18,'B',11,'close call. NOTE: this whole chapter is the tier split most likely to be wrong - L11 gives all ten PDs full treatment. Promoting the seven Tier B PDs is +1.5 h review and the cheapest place to spend a spare hour'),
  ('paranoid-personality-disorder','Paranoid personality disorder',18,'B',11,null),
  ('schizoid-personality-disorder','Schizoid personality disorder',18,'B',11,null),
  ('histrionic-personality-disorder','Histrionic personality disorder',18,'B',11,'includes the gender-bias critique'),
  ('avoidant-personality-disorder','Avoidant personality disorder',18,'B',11,null),
  ('dependent-personality-disorder','Dependent personality disorder',18,'B',11,'includes sociotropy/autonomy'),
  ('obsessive-compulsive-personality-disorder','Obsessive-compulsive personality disorder',18,'B',11,'not to be confused with OCD'),

  -- ── 19. Paraphilic (L7) ───────────────────────────────────────────
  ('paraphilic-disorders','Paraphilic disorders',19,'overview',7,'REWRITE-LEVEL REVIEW (~30 min, not 15): the framing works live in a room with a lecturer present and does not work as unattended reference text'),
  ('pedophilic-disorder','Pedophilic disorder',19,'A',7,null),
  ('exhibitionistic-disorder','Exhibitionistic disorder',19,'A',7,null),
  ('voyeuristic-disorder','Voyeuristic disorder',19,'B',7,null),
  ('fetishistic-disorder','Fetishistic disorder',19,'B',7,null),
  ('transvestic-disorder','Transvestic disorder',19,'B',7,null),
  ('sexual-sadism-and-masochism-disorders','Sexual sadism disorder and sexual masochism disorder',19,'B',7,'one page: L7 teaches them together')
) as v(slug, title, chapter, tier, lecture, note)
where c.code = 'PSY240' and c.term = '2026F'
on conflict (course_id, slug) do nothing;

-- Link catalog rows to any wiki page that already exists under the same slug
-- (the first three ingests created 22 pages before this catalog existed).
update public.disorders d
set page_id = p.id
from public.wiki_pages p
where p.course_id = d.course_id and p.slug = d.slug and d.page_id is null;

-- =====================================================================
-- 2. REVIEW PATH
-- =====================================================================
-- Promotes a pending proposal into accepted page content, or rejects it.
-- SECURITY DEFINER + explicit staff check, so wiki_pages keeps no
-- authenticated write policies. The page-content UPDATE fires the existing
-- triggers: an 'accepted' version snapshot and wikilink extraction.
--
-- p_content lets a reviewer edit before accepting — the common case for the
-- two pages flagged as rewrite-level. Passing null accepts as proposed.

create or replace function public.review_proposal(
  p_version_id uuid,
  p_decision   text,                      -- 'accept' | 'reject'
  p_content    text default null,         -- reviewer's edited body; null = as proposed
  p_publish    boolean default true       -- accept → 'published', else 'draft'
)
returns jsonb
language plpgsql
security definer
set search_path = public, identity
as $$
declare
  v        public.wiki_page_versions%rowtype;
  pg       public.wiki_pages%rowtype;
  reviewer uuid;
begin
  if p_decision not in ('accept', 'reject') then
    raise exception 'decision must be accept or reject, got %', p_decision;
  end if;

  reviewer := public.current_person_id();
  if reviewer is null then
    raise exception 'no identity for caller';
  end if;

  select * into v from public.wiki_page_versions where id = p_version_id;
  if not found then
    raise exception 'no such version %', p_version_id;
  end if;
  if v.kind <> 'proposed' then
    raise exception 'version % is not a proposal (kind=%)', p_version_id, v.kind;
  end if;
  if v.review_status <> 'pending' then
    raise exception 'version % already %', p_version_id, v.review_status;
  end if;

  select * into pg from public.wiki_pages where id = v.page_id;
  if not public.is_course_staff(pg.course_id) then
    raise exception 'not a TA or instructor on this course';
  end if;

  if p_decision = 'reject' then
    update public.wiki_page_versions
    set review_status = 'rejected', reviewed_by = reviewer, reviewed_at = now()
    where id = p_version_id;

    return jsonb_build_object(
      'decision', 'rejected', 'version_id', p_version_id, 'slug', pg.slug);
  end if;

  -- accept: page content becomes the reviewed body (edited or as proposed)
  update public.wiki_pages
  set content    = coalesce(p_content, v.content),
      title      = coalesce(v.title, title),
      summary    = coalesce(v.summary, summary),
      status     = case when p_publish then 'published' else 'draft' end,
      updated_by = reviewer
  where id = v.page_id;

  update public.wiki_page_versions
  set review_status = 'accepted',
      reviewed_by   = reviewer,
      reviewed_at   = now(),
      content       = coalesce(p_content, content)   -- record what was actually accepted
  where id = p_version_id;

  select * into pg from public.wiki_pages where id = v.page_id;

  return jsonb_build_object(
    'decision',        'accepted',
    'version_id',      p_version_id,
    'page_id',         pg.id,
    'slug',            pg.slug,
    'status',          pg.status,
    'current_version', pg.current_version,
    'edited',          p_content is not null,
    'links_extracted', (select count(*) from public.wiki_links where source_page_id = pg.id)
  );
end;
$$;

revoke all on function public.review_proposal(uuid, text, text, boolean) from public;
grant execute on function public.review_proposal(uuid, text, text, boolean) to authenticated;

comment on function public.review_proposal is
  'WP3 review path. Staff-only (checked internally). Accept promotes a pending proposal into wiki_pages.content — firing the accepted-version snapshot and wikilink extraction triggers — or reject marks it rejected. p_content accepts a reviewer edit.';

-- Queue view: pending proposals with the page they target and the current body
-- to diff against. Staff-visible via the underlying tables' existing policies.
create or replace view public.review_queue as
select
  v.id           as version_id,
  v.created_at   as proposed_at,
  v.action,
  v.job_id,
  p.id           as page_id,
  p.course_id,
  p.slug,
  p.type,
  p.status       as page_status,
  coalesce(v.title, p.title)     as proposed_title,
  coalesce(v.summary, p.summary) as proposed_summary,
  v.content      as proposed_content,
  p.content      as current_content,
  (p.content is null)            as is_first_content,
  length(coalesce(v.content, '')) as proposed_length,
  d.tier,
  d.tier_review_note
from public.wiki_page_versions v
join public.wiki_pages p on p.id = v.page_id
left join public.disorders d on d.course_id = p.course_id and d.slug = p.slug
where v.kind = 'proposed' and v.review_status = 'pending';

comment on view public.review_queue is
  'Pending proposals with their target page and current body, for the WP3 review UI. tier_review_note surfaces the rewrite-level flags from the taxonomy seed.';
