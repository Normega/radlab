-- A display element can be published to a public page (/resources/:slug), so the
-- same text a session shows can be linked from an email for anyone to read,
-- signed in or not. First use: the PSY240 class trial's support list
-- (`class_trial_support`), linked from every trial email's footer, so there is
-- one copy of the list rather than a page and a step that drift apart.
--
-- Off by default. Only rows marked public are readable without signing in; the
-- existing policies (authenticated read, lab write) are unchanged. anon already holds the
-- default table grants; with RLS on and no anon policy until now, it could read nothing.

alter table displays add column if not exists public boolean not null default false;

create policy "public displays, anyone reads"
  on displays for select
  to anon
  using (public);

update displays set public = true where slug = 'class_trial_support';
