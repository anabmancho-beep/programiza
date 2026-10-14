-- ===== Helpers =====
create or replace function public.is_pro() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id and p.center_id = ur.center_id
                 where ur.user_id = auth.uid() and ur.role in ('admin','profesional'))
$$;

create or replace function public._log(_person_id uuid, _action text) returns void language plpgsql security definer set search_path = public as $$
declare c uuid; pcode text;
begin
  select center_id, code into c, pcode from public.persons where id = _person_id;
  if c is null then return; end if;
  insert into public.access_logs(center_id, user_id, person_id, person_code, action) values (c, auth.uid(), _person_id, pcode, _action);
end $$;
revoke execute on function public._log(uuid, text) from public, anon, authenticated;

create or replace function public.log_access(_person_id uuid, _action text)
 returns void language plpgsql security definer set search_path to 'public' as $function$
declare c uuid := public.current_center_id(); pcode text;
begin
  if c is null or not public.is_staff() then raise exception 'Sin acceso'; end if;
  if _action not in ('abrir','editar','crear','exportar','anonimizar','eliminar','sugerencia_ia','seguimiento','informe','exportar_pdf','ver_evolucion','lectura_facil','invitar_familia','compartir_familia') then raise exception 'Acción no válida'; end if;
  select code into pcode from public.persons where id = _person_id and center_id = c;
  if pcode is null then raise exception 'Persona no encontrada'; end if;
  insert into public.access_logs(center_id,user_id,person_id,person_code,action) values (c, auth.uid(), _person_id, pcode, _action);
end $function$;

-- ===== Tighter visibility (family accounts must not see team, roles or join code) =====
create or replace function public.my_staff_center_ids() returns setof uuid language sql stable security definer set search_path = public as $$
  select center_id from public.user_roles where user_id = auth.uid() and role <> 'familia'
$$;

drop policy if exists "Ver mi centro" on public.centers;
create policy "Staff ve sus centros" on public.centers for select to authenticated
  using (id in (select public.my_staff_center_ids()));

drop policy if exists "Ver perfiles del centro" on public.profiles;
create policy "Ver perfiles del centro" on public.profiles for select to authenticated
  using (id = auth.uid() or (public.is_staff() and exists (select 1 from public.user_roles ur where ur.user_id = profiles.id and ur.center_id = public.current_center_id())));

drop policy if exists "Ver roles del centro" on public.user_roles;
create policy "Ver roles del centro" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or (center_id = public.current_center_id() and public.is_staff()));

-- ===== Multi-center =====
create or replace function public.my_centers() returns table(id uuid, name text, role public.app_role) language sql stable security definer set search_path = public as $$
  select c.id, c.name, ur.role from public.user_roles ur join public.centers c on c.id = ur.center_id
  where ur.user_id = auth.uid() and ur.role <> 'familia' order by c.name
$$;

create or replace function public.switch_center(_center_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where user_id = auth.uid() and center_id = _center_id and role <> 'familia') then
    raise exception 'No perteneces a ese centro';
  end if;
  update public.profiles set center_id = _center_id where id = auth.uid();
end $$;

create or replace function public.create_center(_name text)
 returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if public.current_center_id() is not null and not public.has_role(auth.uid(),'admin') then raise exception 'Solo un administrador puede crear otro centro'; end if;
  if char_length(trim(_name)) < 2 then raise exception 'Nombre demasiado corto'; end if;
  insert into public.centers(name, created_by) values (trim(_name), auth.uid()) returning id into cid;
  update public.profiles set center_id = cid where id = auth.uid();
  insert into public.user_roles(user_id, center_id, role) values (auth.uid(), cid, 'admin');
  return cid;
end $function$;

-- ===== Pictograms =====
create table public.pictograms (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  storage_path text not null,
  license_confirmed boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.pictograms to authenticated;
grant all on public.pictograms to service_role;
alter table public.pictograms enable row level security;
create policy "Staff ve pictogramas" on public.pictograms for select to authenticated using (center_id = public.current_center_id() and public.is_staff());
create policy "Staff sube pictogramas" on public.pictograms for insert to authenticated
  with check (center_id = public.current_center_id() and public.is_staff() and license_confirmed and storage_path like center_id::text || '/%');
create policy "Staff renombra pictogramas" on public.pictograms for update to authenticated using (center_id = public.current_center_id() and public.is_staff()) with check (center_id = public.current_center_id());
create policy "Staff borra pictogramas" on public.pictograms for delete to authenticated using (center_id = public.current_center_id() and public.is_staff());

alter table public.plan_activities add column pictogram_id uuid references public.pictograms(id) on delete set null;
alter table public.activity_bank add column pictogram_id uuid references public.pictograms(id) on delete set null;

create policy "Centro lee sus pictogramas" on storage.objects for select to authenticated
  using (bucket_id = 'pictogramas' and (storage.foldername(name))[1] = public.current_center_id()::text);
create policy "Staff sube pictogramas" on storage.objects for insert to authenticated
  with check (bucket_id = 'pictogramas' and (storage.foldername(name))[1] = public.current_center_id()::text and public.is_staff());
create policy "Staff borra pictogramas" on storage.objects for delete to authenticated
  using (bucket_id = 'pictogramas' and (storage.foldername(name))[1] = public.current_center_id()::text and public.is_staff());

create or replace function public.duplicate_week(_plan_id uuid, _new_start date)
 returns uuid language plpgsql set search_path to 'public' as $function$
declare src public.plans; nid uuid;
begin
  select * into src from public.plans where id = _plan_id;
  if src.id is null or src.level <> 'semanal' then raise exception 'Solo se pueden duplicar semanas'; end if;
  insert into public.plans(center_id, person_id, parent_id, level, title, objectives, start_date, end_date, is_template, created_by)
  values (src.center_id, src.person_id, src.parent_id, 'semanal', src.title || ' (copia)', src.objectives, _new_start, _new_start + 6, src.is_template, auth.uid())
  returning id into nid;
  insert into public.plan_activities(center_id, plan_id, title, area, duration_min, support_level, materials, steps, adaptations, day_of_week, time_slot, position, ai_generated, status, pictogram_id)
  select center_id, nid, title, area, duration_min, support_level, materials, steps, adaptations, day_of_week, time_slot, position, ai_generated, status, pictogram_id
  from public.plan_activities where plan_id = _plan_id;
  return nid;
end $function$;

-- ===== Families =====
alter table public.reports add column shared_with_family boolean not null default false;

create table public.family_invites (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  person_id uuid not null references public.persons(id) on delete cascade,
  email text not null,
  token text not null unique default (replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_by uuid,
  accepted_at timestamptz
);
grant select, delete on public.family_invites to authenticated;
grant all on public.family_invites to service_role;
alter table public.family_invites enable row level security;
create policy "Staff ve invitaciones" on public.family_invites for select to authenticated using (center_id = public.current_center_id() and public.is_staff());
create policy "Staff anula invitaciones" on public.family_invites for delete to authenticated using (center_id = public.current_center_id() and public.is_staff());

create table public.family_links (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  person_id uuid not null references public.persons(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (person_id, user_id)
);
grant select, delete on public.family_links to authenticated;
grant all on public.family_links to service_role;
alter table public.family_links enable row level security;
create policy "Staff ve accesos de familia" on public.family_links for select to authenticated using (center_id = public.current_center_id() and public.is_staff());
create policy "Staff retira accesos de familia" on public.family_links for delete to authenticated using (center_id = public.current_center_id() and public.is_staff());

create or replace function public.create_family_invite(_person_id uuid, _email text) returns text language plpgsql security definer set search_path = public as $$
declare c uuid := public.current_center_id(); st public.consent_status; tok text;
begin
  if c is null or not public.is_staff() then raise exception 'Sin acceso'; end if;
  select consent_status into st from public.persons where id = _person_id and center_id = c;
  if st is null then raise exception 'Persona no encontrada'; end if;
  if st <> 'otorgado' then raise exception 'Solo se puede invitar a la familia con el consentimiento otorgado'; end if;
  if _email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(_email) > 200 then raise exception 'Correo no válido'; end if;
  insert into public.family_invites(center_id, person_id, email) values (c, _person_id, lower(trim(_email))) returning token into tok;
  perform public._log(_person_id, 'invitar_familia');
  return tok;
end $$;

create or replace function public.invite_status(_token text) returns text language plpgsql stable security definer set search_path = public as $$
declare i public.family_invites;
begin
  select * into i from public.family_invites where token = _token;
  if i.id is null then return 'no_valida'; end if;
  if i.accepted_at is not null then return 'usada'; end if;
  if i.expires_at < now() then return 'caducada'; end if;
  return 'pendiente';
end $$;

create or replace function public.accept_family_invite(_token text) returns void language plpgsql security definer set search_path = public as $$
declare i public.family_invites; st public.consent_status;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into i from public.family_invites where token = _token for update;
  if i.id is null then raise exception 'Invitación no válida'; end if;
  if i.accepted_at is not null then raise exception 'Esta invitación ya se ha usado'; end if;
  if i.expires_at < now() then raise exception 'La invitación ha caducado. Pide una nueva al centro'; end if;
  if lower(coalesce(auth.jwt()->>'email','')) <> lower(i.email) then raise exception 'Inicia sesión con el correo al que se envió la invitación'; end if;
  select consent_status into st from public.persons where id = i.person_id;
  if st is distinct from 'otorgado' then raise exception 'El acceso no está disponible: falta el consentimiento'; end if;
  if exists (select 1 from public.user_roles where user_id = auth.uid() and role <> 'familia') then
    raise exception 'Esta cuenta pertenece a un equipo profesional. Usa otro correo para el acceso de familia';
  end if;
  insert into public.user_roles(user_id, center_id, role) values (auth.uid(), i.center_id, 'familia') on conflict (user_id, center_id) do nothing;
  update public.profiles set center_id = i.center_id where id = auth.uid();
  insert into public.family_links(center_id, person_id, user_id) values (i.center_id, i.person_id, auth.uid()) on conflict do nothing;
  update public.family_invites set accepted_by = auth.uid(), accepted_at = now() where id = i.id;
end $$;

create or replace function public._family_can(_person_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'familia') and exists (
    select 1 from public.family_links fl join public.persons p on p.id = fl.person_id
    where fl.person_id = _person_id and fl.user_id = auth.uid() and fl.center_id = public.current_center_id() and p.consent_status = 'otorgado')
$$;

create or replace function public.family_overview() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'familia') then raise exception 'Sin acceso'; end if;
  return jsonb_build_object(
    'center', (select name from public.centers where id = public.current_center_id()),
    'persons', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'code', p.code) order by p.code)
       from public.family_links fl join public.persons p on p.id = fl.person_id
       where fl.user_id = auth.uid() and fl.center_id = public.current_center_id() and p.consent_status = 'otorgado'), '[]'::jsonb));
end $$;

create or replace function public.family_week(_person_id uuid, _date date) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.plans;
begin
  if not public._family_can(_person_id) then raise exception 'Sin acceso'; end if;
  perform public._log(_person_id, 'familia_ver_agenda');
  select * into pl from public.plans where person_id = _person_id and level = 'semanal' and not is_template
    and start_date <= _date and end_date >= _date order by start_date desc limit 1;
  if pl.id is null then return null; end if;
  return jsonb_build_object('title', pl.title, 'start', pl.start_date, 'end', pl.end_date,
    'activities', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'area', a.area, 'duration_min', a.duration_min,
        'day_of_week', a.day_of_week, 'time_slot', a.time_slot, 'steps', a.steps, 'pictogram_path', pg.storage_path) order by a.day_of_week, a.time_slot, a.position)
      from public.plan_activities a left join public.pictograms pg on pg.id = a.pictogram_id
      where a.plan_id = pl.id and a.status = 'aprobado'), '[]'::jsonb));
end $$;

create or replace function public.family_reports(_person_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._family_can(_person_id) then raise exception 'Sin acceso'; end if;
  perform public._log(_person_id, 'familia_ver_informes');
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'period_start', r.period_start, 'period_end', r.period_end, 'content', r.content, 'approved_at', r.approved_at) order by r.period_end desc)
    from public.reports r where r.person_id = _person_id and r.status = 'aprobado' and r.shared_with_family), '[]'::jsonb);
end $$;

-- ===== Behaviour (ABC), anticipation, health: no direct table access; RPCs check role and always log =====
create table public.behavior_records (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  person_id uuid not null references public.persons(id) on delete cascade,
  occurred_at timestamptz not null,
  antecedent text not null, behavior text not null, consequence text not null, notes text,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.anticipation_plans (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  person_id uuid not null unique references public.persons(id) on delete cascade,
  early_signs text, what_helps text, what_to_avoid text,
  updated_by uuid, updated_at timestamptz not null default now()
);
create table public.medications (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  person_id uuid not null references public.persons(id) on delete cascade,
  name text not null, prescribed_regimen text not null, prescriber text, start_date date, end_date date, notes text,
  created_by uuid, created_at timestamptz not null default now()
);
create table public.medical_appointments (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  person_id uuid not null references public.persons(id) on delete cascade,
  scheduled_at timestamptz not null, specialty text not null, place text, notes text, done boolean not null default false,
  created_by uuid, created_at timestamptz not null default now()
);
grant all on public.behavior_records, public.anticipation_plans, public.medications, public.medical_appointments to service_role;
alter table public.behavior_records enable row level security;
alter table public.anticipation_plans enable row level security;
alter table public.medications enable row level security;
alter table public.medical_appointments enable row level security;

create or replace function public._pro_person(_person_id uuid) returns uuid language plpgsql stable security definer set search_path = public as $$
declare c uuid := public.current_center_id();
begin
  if c is null or not public.is_pro() then raise exception 'Solo profesionales y administración'; end if;
  if not exists (select 1 from public.persons where id = _person_id and center_id = c) then raise exception 'Persona no encontrada'; end if;
  return c;
end $$;
revoke execute on function public._pro_person(uuid) from public, anon;

create or replace function public.get_behavior_module(_person_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._pro_person(_person_id);
  perform public._log(_person_id, 'ver_conductas');
  return jsonb_build_object(
    'records', coalesce((select jsonb_agg(to_jsonb(b) - 'center_id' order by b.occurred_at desc) from public.behavior_records b where b.person_id = _person_id), '[]'::jsonb),
    'plan', (select to_jsonb(a) - 'center_id' from public.anticipation_plans a where a.person_id = _person_id));
end $$;

create or replace function public.get_health(_person_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._pro_person(_person_id);
  perform public._log(_person_id, 'ver_salud');
  return jsonb_build_object(
    'medications', coalesce((select jsonb_agg(to_jsonb(m) - 'center_id' order by m.created_at desc) from public.medications m where m.person_id = _person_id), '[]'::jsonb),
    'appointments', coalesce((select jsonb_agg(to_jsonb(a) - 'center_id' order by a.scheduled_at) from public.medical_appointments a where a.person_id = _person_id), '[]'::jsonb));
end $$;

create or replace function public.save_sensitive(_kind text, _person_id uuid, _id uuid, _d jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare c uuid := public._pro_person(_person_id); rid uuid; t text;
begin
  if _kind = 'conducta' then
    if coalesce(trim(_d->>'antecedent'),'') = '' or coalesce(trim(_d->>'behavior'),'') = '' or coalesce(trim(_d->>'consequence'),'') = '' then raise exception 'Antecedente, conducta y consecuencia son obligatorios'; end if;
    if _id is null then
      insert into public.behavior_records(center_id, person_id, occurred_at, antecedent, behavior, consequence, notes, created_by)
      values (c, _person_id, (_d->>'occurred_at')::timestamptz, left(_d->>'antecedent',2000), left(_d->>'behavior',2000), left(_d->>'consequence',2000), nullif(left(_d->>'notes',2000),''), auth.uid()) returning id into rid;
    else
      update public.behavior_records set occurred_at = (_d->>'occurred_at')::timestamptz, antecedent = left(_d->>'antecedent',2000), behavior = left(_d->>'behavior',2000),
        consequence = left(_d->>'consequence',2000), notes = nullif(left(_d->>'notes',2000),''), updated_at = now()
      where id = _id and person_id = _person_id returning id into rid;
    end if;
    t := 'conducta';
  elsif _kind = 'anticipacion' then
    insert into public.anticipation_plans(center_id, person_id, early_signs, what_helps, what_to_avoid, updated_by)
    values (c, _person_id, left(_d->>'early_signs',3000), left(_d->>'what_helps',3000), left(_d->>'what_to_avoid',3000), auth.uid())
    on conflict (person_id) do update set early_signs = excluded.early_signs, what_helps = excluded.what_helps, what_to_avoid = excluded.what_to_avoid, updated_by = auth.uid(), updated_at = now()
    returning id into rid;
    t := 'plan_anticipacion';
  elsif _kind = 'medicacion' then
    if coalesce(trim(_d->>'name'),'') = '' or coalesce(trim(_d->>'prescribed_regimen'),'') = '' then raise exception 'Indica el medicamento y la pauta tal como figura en la receta'; end if;
    if _id is null then
      insert into public.medications(center_id, person_id, name, prescribed_regimen, prescriber, start_date, end_date, notes, created_by)
      values (c, _person_id, left(_d->>'name',200), left(_d->>'prescribed_regimen',500), nullif(left(_d->>'prescriber',200),''), nullif(_d->>'start_date','')::date, nullif(_d->>'end_date','')::date, nullif(left(_d->>'notes',1000),''), auth.uid()) returning id into rid;
    else
      update public.medications set name = left(_d->>'name',200), prescribed_regimen = left(_d->>'prescribed_regimen',500), prescriber = nullif(left(_d->>'prescriber',200),''),
        start_date = nullif(_d->>'start_date','')::date, end_date = nullif(_d->>'end_date','')::date, notes = nullif(left(_d->>'notes',1000),'')
      where id = _id and person_id = _person_id returning id into rid;
    end if;
    t := 'salud';
  elsif _kind = 'cita' then
    if coalesce(trim(_d->>'specialty'),'') = '' or coalesce(_d->>'scheduled_at','') = '' then raise exception 'Indica la fecha y la especialidad'; end if;
    if _id is null then
      insert into public.medical_appointments(center_id, person_id, scheduled_at, specialty, place, notes, done, created_by)
      values (c, _person_id, (_d->>'scheduled_at')::timestamptz, left(_d->>'specialty',200), nullif(left(_d->>'place',200),''), nullif(left(_d->>'notes',1000),''), coalesce((_d->>'done')::boolean,false), auth.uid()) returning id into rid;
    else
      update public.medical_appointments set scheduled_at = (_d->>'scheduled_at')::timestamptz, specialty = left(_d->>'specialty',200), place = nullif(left(_d->>'place',200),''),
        notes = nullif(left(_d->>'notes',1000),''), done = coalesce((_d->>'done')::boolean,false)
      where id = _id and person_id = _person_id returning id into rid;
    end if;
    t := 'salud';
  else raise exception 'Tipo no válido'; end if;
  if rid is null then raise exception 'Registro no encontrado'; end if;
  perform public._log(_person_id, t);
  return rid;
end $$;

create or replace function public.delete_sensitive(_kind text, _person_id uuid, _id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._pro_person(_person_id);
  if _kind = 'conducta' then delete from public.behavior_records where id = _id and person_id = _person_id;
  elsif _kind = 'medicacion' then delete from public.medications where id = _id and person_id = _person_id;
  elsif _kind = 'cita' then delete from public.medical_appointments where id = _id and person_id = _person_id;
  else raise exception 'Tipo no válido'; end if;
  if not found then raise exception 'Registro no encontrado'; end if;
  perform public._log(_person_id, case when _kind = 'conducta' then 'conducta_eliminar' else 'salud_eliminar' end);
end $$;

create or replace function public.upcoming_appointments(_days int default 7) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c uuid := public.current_center_id();
begin
  if c is null or not public.is_pro() then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'person_id', a.person_id, 'code', p.code, 'scheduled_at', a.scheduled_at, 'specialty', a.specialty, 'place', a.place) order by a.scheduled_at)
    from public.medical_appointments a join public.persons p on p.id = a.person_id
    where a.center_id = c and not a.done and a.scheduled_at >= now() - interval '1 hour' and a.scheduled_at <= now() + make_interval(days => least(greatest(_days,1),60))), '[]'::jsonb);
end $$;

-- ===== GDPR: include/remove new data =====
create or replace function public.anonymize_person(_person_id uuid)
 returns void language plpgsql security definer set search_path to 'public' as $function$
declare c uuid := public.current_center_id();
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Solo el administrador'; end if;
  perform public.log_access(_person_id, 'anonimizar');
  update public.persons set
    code = 'ANON-' || upper(substr(md5(gen_random_uuid()::text),1,6)),
    diagnosis = null, autonomy = '{}'::jsonb, supports = null, communication = null, likes = null,
    sensitivities = null, routines = null, consent_status = 'retirado', consent_grantor = null,
    consent_date = null, consent_purpose = null, anonymized = true, age_range = 'No consta', main_type = 'No consta'
  where id = _person_id and center_id = c;
  update public.plan_activities a set adaptations = null from public.plans pl where pl.id = a.plan_id and pl.person_id = _person_id;
  delete from public.behavior_records where person_id = _person_id;
  delete from public.anticipation_plans where person_id = _person_id;
  delete from public.medications where person_id = _person_id;
  delete from public.medical_appointments where person_id = _person_id;
  delete from public.family_links where person_id = _person_id;
  delete from public.family_invites where person_id = _person_id;
  update public.access_logs set person_code = null where person_id = _person_id;
end $function$;

create or replace function public.export_person(_person_id uuid)
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare c uuid := public.current_center_id(); r jsonb;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Solo el administrador'; end if;
  select jsonb_build_object(
    'persona', to_jsonb(p) - 'center_id',
    'programaciones', coalesce((select jsonb_agg(to_jsonb(pl) - 'center_id') from public.plans pl where pl.person_id = p.id), '[]'::jsonb),
    'actividades', coalesce((select jsonb_agg(to_jsonb(a) - 'center_id') from public.plan_activities a join public.plans pl on pl.id = a.plan_id where pl.person_id = p.id), '[]'::jsonb),
    'conductas', coalesce((select jsonb_agg(to_jsonb(b) - 'center_id') from public.behavior_records b where b.person_id = p.id), '[]'::jsonb),
    'plan_anticipacion', (select to_jsonb(x) - 'center_id' from public.anticipation_plans x where x.person_id = p.id),
    'medicacion', coalesce((select jsonb_agg(to_jsonb(m) - 'center_id') from public.medications m where m.person_id = p.id), '[]'::jsonb),
    'citas', coalesce((select jsonb_agg(to_jsonb(m) - 'center_id') from public.medical_appointments m where m.person_id = p.id), '[]'::jsonb),
    'registro_accesos', coalesce((select jsonb_agg(to_jsonb(l) - 'center_id') from public.access_logs l where l.person_id = p.id), '[]'::jsonb),
    'exportado_en', now()
  ) into r from public.persons p where p.id = _person_id and p.center_id = c;
  if r is null then raise exception 'Persona no encontrada'; end if;
  perform public.log_access(_person_id, 'exportar');
  return r;
end $function$;