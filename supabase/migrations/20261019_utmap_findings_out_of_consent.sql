-- UTMAP 2026: the consent form and debrief no longer state earlier waves' findings
-- where they could shape the answers being measured (Norm, 2026-10-19).
--
-- Whether students believe mental health struggles are becoming more common, how
-- they see their peers, and how often they hear peers talk about mental health are
-- all things this wave measures. The consent form told participants, before the
-- first question, that most students believed things had got worse, that the
-- belief tracked hearing peers talk, and that students "misjudge" their peers. The
-- debrief gave the exposure finding just before the one-week follow-up asks
-- exposure and the belief again; it now says that result comes at the end of the
-- follow-up. The flyer, table sign, notice, script and follow-up email were changed
-- the same day (ethics package, Attachments 1, 3, 4, 6, 7, 8).
--
-- Consent forms and debriefs are versioned rows: this inserts new versions and
-- points the study at them, leaving the previous versions in place. The study is
-- still in its internal pilot (its consent form says so), with test enrollments only.

DO $$
DECLARE
  sid      uuid := 'f5a2db89-9697-489f-9a16-dea9c64053e0';
  old_c    uuid;
  old_d    uuid;
  c_html   text;
  d_html   text;
  new_c    text;
  new_d    text;
  new_cid  uuid;
  new_did  uuid;
BEGIN
  SELECT active_consent_form_id, active_debrief_form_id INTO old_c, old_d
    FROM studies WHERE id = sid;
  SELECT html_content INTO c_html FROM study_consent_forms WHERE id = old_c;
  SELECT html_content INTO d_html FROM study_debrief_forms WHERE id = old_d;

  -- consent: the three paragraphs under "What this study is about"
  new_c := regexp_replace(c_html, '<p>People say often that student mental health is getting worse\.[^<]*</p>',
    $t$<p>People often ask whether student mental health is changing. It is surprisingly
hard to know, because it needs the same questions asked the same way over several
years.</p>$t$);
  new_c := regexp_replace(new_c, '<p>We have run this survey at UTM in 2023, 2024 and 2025\.[^<]*</p>',
    $t$<p>We have run this survey at UTM in 2023, 2024 and 2025, asking the same
questions the same way each time. We share what earlier years found afterwards
rather than now, so that it does not shape your answers.</p>$t$);
  new_c := regexp_replace(new_c, '<p>This year we are adding a third year of the same measurements, testing why[^<]*</p>',
    $t$<p>This year we are adding a third year of the same measurements, looking at how
students see each other's wellbeing, and asking for the first time whether students
who needed mental health help were able to get it.</p>$t$);

  -- debrief: the opening line, and the exposure finding moves to the follow-up
  new_d := regexp_replace(d_html, '<p>It is widely said that student mental health is getting worse\.[^<]*</p>',
    $t$<p>We wanted to find out how UTM students are doing, whether that is changing from
year to year, and whether students' beliefs about each other match what we
measure.</p>$t$);
  new_d := regexp_replace(new_d, '<p><strong>Students were not accurate about each other\.</strong>[^<]*</p>',
    $t$<p><strong>Students were not accurate about each other.</strong> When we asked
students to estimate how their peers were doing, their estimates had surprisingly
little to do with how they themselves were doing. Students who were struggling tended
to overestimate how much their peers were struggling. Students who were doing well
tended to underestimate it.</p>
<p><strong>One result comes later.</strong> We also asked whether students think
mental health struggles are becoming more common, and what shapes that view. The
one-week follow-up asks about this again, so we share that result at the end of the
follow-up and in this year's summary, rather than here, where it could shape the
follow-up answers.</p>$t$);

  IF new_c ~* '(getting worse|got worse|misjudge|predicted that belief)'
     OR new_d ~* '(getting worse|got worse|predicted that belief|talking about mental health)'
     OR new_c = c_html OR new_d = d_html THEN
    RAISE EXCEPTION 'UTMAP consent/debrief text did not match; nothing changed';
  END IF;

  INSERT INTO study_consent_forms (study_id, docx_url, html_content, uploaded_by)
    SELECT study_id, docx_url, new_c, uploaded_by FROM study_consent_forms WHERE id = old_c
    RETURNING id INTO new_cid;
  INSERT INTO study_debrief_forms (study_id, docx_url, html_content, uploaded_by)
    SELECT study_id, docx_url, new_d, uploaded_by FROM study_debrief_forms WHERE id = old_d
    RETURNING id INTO new_did;

  UPDATE studies SET active_consent_form_id = new_cid, active_debrief_form_id = new_did
   WHERE id = sid;
END $$;
