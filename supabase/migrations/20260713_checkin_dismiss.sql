-- "Back to lobby" instructor control. Found live: ClassRoom/ClassScreen
-- restore their state on load by picking the most-recently-touched
-- non-planned checkin with no time cutoff at all, so once a checkin hits
-- results_ready it stays "the live one" forever (until a newer checkin
-- opens) — students/screen reloading mid-lobby keep seeing stale results
-- from a past check-in, and the avatar wall (which only renders in the true
-- idle branch) never gets a chance to show. dismissed_at lets the
-- instructor explicitly close that out; the restore queries skip dismissed
-- checkins entirely, falling through to genuine idle.

ALTER TABLE checkins ADD COLUMN dismissed_at timestamptz;
