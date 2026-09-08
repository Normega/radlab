-- L1 (2026-09-08): 41 check-in submissions died with "canceling statement
-- due to statement timeout" — single-row upserts couldn't complete inside
-- 8s while ~35 clients hit the database at once (logical decoding was also
-- straining: one Realtime WAL read logged at 13s). 15s gives a contended
-- write room to land; a healthy write still returns in milliseconds, so the
-- only queries this actually lengthens are ones that would have failed.
-- Norm approved shipping the free load fixes 2026-09-08.
alter role authenticated set statement_timeout = '15s';
