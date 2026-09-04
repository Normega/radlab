-- A fourth verdict: 'minor'.
--
-- After the weak-summary miss, the judging prompt was tightened to "one such
-- error is enough" — which over-corrected. Tested against a strong summary,
-- the model found a single arguable imprecision, described it in its own note
-- as "a minor genre slip but the rest matches the paper closely", and still
-- had to return the same red verdict as a summary carrying four flat
-- contradictions. A verdict that cannot separate those two is not usable for
-- deciding whether to send work back.
--
-- 'minor' means faithful in substance, with something worth a word in passing.
-- It is amber in the queue and, unlike 'diverges', seeds no send-back note.

alter table gap_claims drop constraint if exists gap_claims_integration_verdict_check;
alter table gap_claims add constraint gap_claims_integration_verdict_check
  check (integration_verdict is null or integration_verdict in ('agrees', 'minor', 'diverges', 'unclear'));
