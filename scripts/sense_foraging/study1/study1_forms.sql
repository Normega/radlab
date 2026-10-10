BEGIN;
WITH c AS (INSERT INTO study_consent_forms (study_id, html_content) VALUES ('74cb6aa5-857c-408e-adfa-a5556acd62b7', '<p style="border:2px solid #c00000;border-radius:12px;padding:8px 16px;color:#c00000"><strong>Study 1 wording, pending REB approval of the amendment.</strong> Not yet recruiting.</p>
<p>UNIVERSITY OF TORONTO</p>
<p>Department of Psychology</p>
<p>Consent to Participate in Research</p>
<p>Development and Validation of the Sense Foraging Scale</p>
<h2>Researchers</h2>
<p>Principal Investigator: Prof. Norman Farb, PhD, Department of Psychological and Brain Sciences, University of Toronto Mississauga, norman.farb@utoronto.ca, 905-828-3959</p>
<h2>Purpose of the Study</h2>
<p>We are developing and testing a new questionnaire that measures people&#x27;s ability to notice and shift into a receptive, open, sensory way of engaging with the world, as distinct from a goal-directed, task-focused way of engaging with it. This study is the first step: it will help us understand how the questionnaire&#x27;s statements group together, so that we can identify the most useful ones and produce a shorter version.</p>
<h2>What You Will Be Asked to Do</h2>
<p>If you agree to take part, you will first answer a few background questions (such as your age, gender, ethnicity, education, religious or spiritual background, and any regular meditation, yoga, or other mind-body practice). You will then complete one questionnaire of 48 short statements about how you pay attention in everyday life, rating how much you agree with each. Two further statements simply ask you to select a particular answer, to check that each statement is being read. The study takes approximately 10 minutes and is completed in a single session.</p>
<h2>Voluntary Participation</h2>
<p>Your participation is entirely voluntary. Every question about you offers a &quot;Prefer not to answer&quot; option, and you may stop the study at any time by closing the browser window, without penalty. If you complete only part of the study, you will still be compensated for the time you spent, consistent with Prolific&#x27;s payment policies.</p>
<h2>Risks</h2>
<p>This study asks about everyday experiences, including how you pay attention and how you respond to stress. Some people may find it mildly uncomfortable to reflect on these topics. The questions do not ask about mood symptoms, self-harm, or suicidal thoughts. If you experience any discomfort, you are free to stop at any time. A list of mental health resources is provided at the end of the study, regardless of your answers.</p>
<h2>Benefits</h2>
<p>There is no direct benefit to you from participating. Your responses will contribute to the development of a new, validated measure that may inform future research and mindfulness-related program design.</p>
<h2>Confidentiality</h2>
<p>We do not collect your name or email address. Your Prolific ID is used only to verify your eligibility and to process your payment; it is permanently removed from the dataset once payment is complete and before any analysis takes place. After that point, your responses cannot be linked back to you, including by the research team.</p>
<p>All data are stored in encrypted form on RADlab, the lab&#x27;s own research platform, accessible only to the research team. Findings will be reported only in aggregate, de-identified form (e.g., &quot;on average, participants reported...&quot;), never in a way that identifies an individual respondent.</p>
<h3>Data Retention and Disposition</h3>
<p>Your Prolific ID is retained only until your payment is confirmed, typically within a few days of your participation, after which it is permanently deleted and cannot be recovered by anyone, including the research team. From that point forward, your responses exist only as part of a de-identified, non-attributable dataset. This de-identified data will be retained indefinitely by the research team, consistent with standard practice in the field, to support reanalysis, replication, and comparison with future research. No identifiable version of your data is retained beyond the payment-confirmation window described above.</p>
<h3>Research Ethics Board Access</h3>
<p>Representatives of the University of Toronto Research Ethics Board may require access to study records, including participant responses, for the purposes of monitoring the research process and ensuring compliance with approved ethics procedures. Any information accessed for this purpose will be held to the same standard of confidentiality described above.</p>
<p>In rare circumstances, de-identified data may also be disclosed if legally required, such as in response to a valid court order.</p>
<h3>Future Use of Your Data (Optional)</h3>
<p>Separately from your participation in this study, we are asking whether you are willing to have your de-identified data permanently deposited in the University of Toronto&#x27;s Dataverse (Borealis), the university&#x27;s own secure research data repository (borealisdata.ca/dataverse/radlab). This is entirely optional and will not affect your participation in the main study, your compensation, or any other part of your experience today.</p>
<p>If you agree, your de-identified data may be shared securely with other academic researchers for peer-review, meta-analyses, or to calculate summary statistics for future research strictly in the areas of mindfulness, wellbeing, and mental health. A citation record describing the dataset will be publicly discoverable and assigned a permanent identifier (DOI), similar to a library catalogue entry — but the underlying data files themselves are restricted, not freely downloadable, and are released only to approved recipients who sign a formal Data Use Agreement governing confidentiality, permitted use, and data destruction.</p>
<p>No directly identifying information will ever be included in this deposit. Your decision on this question is independent of your decision to participate in the study today, will not be shared with anyone, and will not affect your compensation.</p>
<h2>Compensation</h2>
<p>You will be paid $12.00 USD per hour, prorated to the time you spend on the study (approximately $2.00 for an estimated 10-minute session), consistent with Prolific&#x27;s fair payment guidelines. Payment is processed through Prolific and is not affected by early withdrawal, provided some responses were submitted, or by how you answer any question.</p>
<h2>Withdrawing Your Data</h2>
<p>Because your Prolific ID is removed shortly after payment is processed, you can request that your data be withdrawn only during that short window. To do so, email norman.farb@utoronto.ca with your Prolific ID within 48 hours of completing the study and state that you would like to withdraw. After de-identification, your specific responses can no longer be located or removed. If you separately consented to depositing your data in the University of Toronto&#x27;s Dataverse (see above), the same 48-hour window applies before deposit; once deposited, individual responses can no longer be identified or withdrawn from the dataset.</p>
<h2>Questions or Concerns</h2>
<p>If you have questions about this study, please contact Prof. Norman Farb at norman.farb@utoronto.ca.</p>
<p>This study has been reviewed and approved by the University of Toronto Research Ethics Board. If you have questions about your rights as a research participant, you may contact the Office of Research Ethics at ethics.review@utoronto.ca or +1 416-946-3273, and reference Protocol # 00051180.</p>
<h2>Consent</h2>
<h3>Main Study Consent (required)</h3>
<p>By checking the box below, you confirm that:</p>
<ul>
<li>You are 18 years of age or older.</li>
<li>You have read and understood the information above.</li>
<li>You voluntarily agree to participate in this study.</li>
<li>You understand you may withdraw at any time, as described above.</li>
</ul>
<h3>Repository / Future Use Consent (optional)</h3>
<p>This is a separate, optional decision and does not affect your participation above.</p>') RETURNING id),
     d AS (INSERT INTO study_debrief_forms (study_id, html_content) VALUES ('74cb6aa5-857c-408e-adfa-a5556acd62b7', '<p style="border:2px solid #c00000;border-radius:12px;padding:8px 16px;color:#c00000"><strong>Study 1 wording, pending REB approval of the amendment.</strong> Not yet recruiting.</p>
<p>UNIVERSITY OF TORONTO</p>
<p>Department of Psychology</p>
<p>Debriefing Statement</p>
<p>Development and Validation of the Sense Foraging Scale</p>
<p>Thank you for participating in this study.</p>
<h2>About This Study</h2>
<p>This study is testing a new questionnaire designed to measure people&#x27;s ability to notice and shift into a receptive, sensory way of engaging with the world (sometimes called &quot;sense foraging&quot;), as distinct from a more goal-directed, evaluative way of engaging with it. In this first study we are examining how the questionnaire&#x27;s 48 statements group together (its factor structure) and which statements best capture each part, so that we can produce a shorter version. Some statements were worded in the opposite direction from others (for example, describing difficulty rather than ease): mixing directions helps us separate what people agree with from a general tendency to agree. A later study will examine how the questionnaire relates to established measures of mindfulness and bodily awareness.</p>
<p>We are also comparing responses between people who regularly engage in a contemplative practice (such as meditation or yoga) and those who do not, to see whether practitioners score differently on this new measure, as a way of testing whether it captures something meaningful. Two statements asked you to select a specific answer; these help us check that statements were read carefully.</p>
<p>No deception was used in this study. All questionnaires you completed were exactly as described.</p>
<h2>Your Data</h2>
<p>As explained in the consent form, your Prolific ID is used only to process payment and is removed from the dataset shortly afterward. If you would like to withdraw your data, please email norman.farb@utoronto.ca with your Prolific ID within 48 hours of completing the study. After that point we can no longer locate or remove your individual responses.</p>
<p>Your responses are not scored or reviewed individually, and no personalized feedback or judgment is generated from them.</p>
<h2>Questions or Concerns</h2>
<p>If you have any questions about this research, please contact Prof. Norman Farb at norman.farb@utoronto.ca.</p>
<p>This study has been reviewed and approved by the University of Toronto Research Ethics Board (Protocol # 00051180). If you have questions about your rights as a research participant, you may contact the Office of Research Ethics at ethics.review@utoronto.ca or +1 416-946-3273.</p>
<h2>Mental Health and Wellbeing Resources</h2>
<p>Taking part in this study involved reflecting on your everyday experiences, including how you pay attention and respond to stress. If anything raised difficult feelings, or if you are experiencing distress for any reason, the resources below are free, confidential, and available regardless of how you answered any of the study questions.</p>
<p>If you are in immediate danger, please contact your local emergency number (for example, 911 in the United States and Canada, 999 in the United Kingdom, 000 in Australia, 112 in Ireland, or 111 in New Zealand).</p>
<h2>United States</h2>
<p>988 Suicide &amp; Crisis Lifeline: Call or text 988  (24/7)</p>
<p>Crisis Text Line: Text HOME to 741741  (24/7)</p>
<h2>Canada</h2>
<p>Talk Suicide Canada: 1-833-456-4566  (24/7)</p>
<p>Text support: Text 45645  (4pm–midnight ET)</p>
<h2>United Kingdom</h2>
<p>Samaritans: 116 123  (24/7, free from any phone)</p>
<p>Shout (text support): Text SHOUT to 85258  (24/7)</p>
<h2>Ireland</h2>
<p>Samaritans: 116 123  (24/7, free from any phone)</p>
<p>Pieta: 1800 247 247  (24/7)</p>
<h2>Australia</h2>
<p>Lifeline Australia: 13 11 14  (24/7)</p>
<p>Text support: Text 0477 13 11 14  (6pm–midnight AEST)</p>
<h2>New Zealand</h2>
<p>Need to Talk: Call or text 1737  (24/7)</p>
<h2>Other Countries</h2>
<p>If you are located outside the countries listed above, Find a Helpline (findahelpline.com) is a free directory that can connect you with a crisis line in your country.</p>
<h2>Non-Crisis Support</h2>
<p>If you would find it helpful to talk to someone but are not in crisis, consider reaching out to a trusted friend or family member, or contacting a doctor or counsellor in your area.</p>
<p>This resource sheet is provided regardless of your responses in the study and does not indicate any assessment of your individual results.</p>
<p>Thank you again for your time and thoughtful responses. Results from this research will be shared through peer-reviewed publications and, in de-identified form, on the Open Science Framework (osf.io).</p>') RETURNING id)
UPDATE studies SET active_consent_form_id = (SELECT id FROM c), active_debrief_form_id = (SELECT id FROM d) WHERE id = '74cb6aa5-857c-408e-adfa-a5556acd62b7';
COMMIT;