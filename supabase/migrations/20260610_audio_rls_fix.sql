-- Fix study_audios write policy: role='admin' → my_role() in ('lab','admin')
drop policy "admin manage study_audios" on study_audios;

create policy "lab manage study_audios"
  on study_audios for all to authenticated
  using (public.my_role() in ('lab', 'admin'))
  with check (public.my_role() in ('lab', 'admin'));
