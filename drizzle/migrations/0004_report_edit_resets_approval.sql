CREATE OR REPLACE FUNCTION public.child_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare c uuid; p uuid;
begin
  if tg_table_name = 'plan_objectives' then
    select center_id into c from public.plans where id = new.plan_id;
  elsif tg_table_name = 'activity_results' then
    select a.center_id, pl.person_id into c, p from public.plan_activities a join public.plans pl on pl.id = a.plan_id where a.id = new.activity_id;
    new.person_id := p;
    if exists (select 1 from public.plan_activities where id = new.activity_id and status <> 'aprobado') then
      raise exception 'Solo se puede registrar seguimiento de actividades aprobadas';
    end if;
  elsif tg_table_name = 'reports' then
    select center_id into c from public.persons where id = new.person_id;
    if new.period_end < new.period_start then raise exception 'Periodo no válido'; end if;
  end if;
  if c is distinct from new.center_id then raise exception 'Elemento de otro centro'; end if;
  if tg_op = 'INSERT' then
    if tg_table_name <> 'activity_results' then
      new.approved_by := null; new.approved_at := null;
      if new.status = 'aprobado' and new.ai_generated then new.status := 'borrador'; end if;
    end if;
  elsif tg_table_name <> 'activity_results' and current_setting('programiza.approving', true) is distinct from 'on' then
    new.approved_by := old.approved_by; new.approved_at := old.approved_at;
    if new.status = 'aprobado' and old.status = 'borrador' then new.status := 'borrador'; end if;
    if tg_table_name = 'reports' and old.status = 'aprobado' and new.content is distinct from old.content then
      new.status := 'borrador'; new.approved_by := null; new.approved_at := null;
    end if;
  end if;
  return new;
end $function$;