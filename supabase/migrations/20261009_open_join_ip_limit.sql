-- open-join allows 20 new sign-ups per hour from one network address per study
-- (env OPEN_JOIN_IP_MAX_PER_HOUR), a guard against scripted sign-ups. A class
-- signing up together in a lecture hall shares one campus network address, so
-- the PSY240 class trial (about 260 students, Oct 14) would be refused after
-- the twentieth. A study may now set its own ceiling; NULL keeps the default.

alter table studies add column if not exists open_join_ip_max_per_hour integer
  check (open_join_ip_max_per_hour is null or open_join_ip_max_per_hour > 0);

comment on column studies.open_join_ip_max_per_hour is
  'open-join: new sign-ups per hour per network address for this study; NULL = the function default (20).';
