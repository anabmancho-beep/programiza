alter table public.plan_activities add column library_picto text
  constraint plan_activities_library_picto_format check (library_picto ~ '^lib-[0-9]{3}$'),
  add constraint plan_activities_one_picto check (library_picto is null or pictogram_id is null);
alter table public.activity_bank add column library_picto text
  constraint activity_bank_library_picto_format check (library_picto ~ '^lib-[0-9]{3}$'),
  add constraint activity_bank_one_picto check (library_picto is null or pictogram_id is null);

create or replace function public.duplicate_week(_plan_id uuid, _new_start date)
 returns uuid language plpgsql set search_path to 'public' as $function$
declare src public.plans; nid uuid;
begin
  select * into src from public.plans where id = _plan_id;
  if src.id is null or src.level <> 'semanal' then raise exception 'Solo se pueden duplicar semanas'; end if;
  insert into public.plans(center_id, person_id, parent_id, level, title, objectives, start_date, end_date, is_template, created_by)
  values (src.center_id, src.person_id, src.parent_id, 'semanal', src.title || ' (copia)', src.objectives, _new_start, _new_start + 6, src.is_template, auth.uid())
  returning id into nid;
  insert into public.plan_activities(center_id, plan_id, title, area, duration_min, support_level, materials, steps, adaptations, day_of_week, time_slot, position, ai_generated, status, pictogram_id, library_picto)
  select center_id, nid, title, area, duration_min, support_level, materials, steps, adaptations, day_of_week, time_slot, position, ai_generated, status, pictogram_id, library_picto
  from public.plan_activities where plan_id = _plan_id;
  return nid;
end $function$;

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
        'day_of_week', a.day_of_week, 'time_slot', a.time_slot, 'steps', a.steps, 'pictogram_path', pg.storage_path, 'library_picto', a.library_picto) order by a.day_of_week, a.time_slot, a.position)
      from public.plan_activities a left join public.pictograms pg on pg.id = a.pictogram_id
      where a.plan_id = pl.id and a.status = 'aprobado'), '[]'::jsonb));
end $$;