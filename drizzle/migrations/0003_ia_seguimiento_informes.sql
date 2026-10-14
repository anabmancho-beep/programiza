
create type public.item_status as enum ('borrador','aprobado');
create type public.result_kind as enum ('lograda','lograda_con_apoyo','no_lograda','no_realizada');

create table public.plan_objectives (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete cascade,
  parent_objective_id uuid references public.plan_objectives(id) on delete set null,
  area text not null,
  description text not null check (char_length(description) between 3 and 500),
  indicator text check (indicator is null or char_length(indicator) <= 300),
  criterion text check (criterion is null or char_length(criterion) <= 300),
  deadline date,
  ai_generated boolean not null default false,
  status public.item_status not null default 'aprobado',
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.plan_objectives to authenticated;
grant all on public.plan_objectives to service_role;
alter table public.plan_objectives enable row level security;
create policy "Staff ve objetivos" on public.plan_objectives for select to authenticated using (center_id = public.current_center_id() and public.is_staff());
create policy "Staff crea objetivos" on public.plan_objectives for insert to authenticated with check (center_id = public.current_center_id() and public.is_staff());
create policy "Staff edita objetivos" on public.plan_objectives for update to authenticated using (center_id = public.current_center_id() and public.is_staff()) with check (center_id = public.current_center_id());
create policy "Staff borra objetivos" on public.plan_objectives for delete to authenticated using (center_id = public.current_center_id() and public.is_staff());

alter table public.plan_activities
  add column objective_id uuid references public.plan_objectives(id) on delete set null,
  add column ai_generated boolean not null default false,
  add column status public.item_status not null default 'aprobado',
  add column approved_by uuid,
  add column approved_at timestamptz;

create table public.activity_results (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  activity_id uuid not null references public.plan_activities(id) on delete cascade,
  person_id uuid references public.persons(id) on delete cascade,
  result_date date not null default current_date,
  result public.result_kind not null,
  support_used text,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.activity_results to authenticated;
grant all on public.activity_results to service_role;
alter table public.activity_results enable row level security;
create policy "Staff ve resultados" on public.activity_results for select to authenticated using (center_id = public.current_center_id() and public.is_staff());
create policy "Staff crea resultados" on public.activity_results for insert to authenticated with check (center_id = public.current_center_id() and public.is_staff());
create policy "Staff edita resultados" on public.activity_results for update to authenticated using (center_id = public.current_center_id() and public.is_staff()) with check (center_id = public.current_center_id());
create policy "Staff borra resultados" on public.activity_results for delete to authenticated using (center_id = public.current_center_id() and public.is_staff());

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  person_id uuid not null references public.persons(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  stats jsonb not null default '{}'::jsonb,
  content text not null default '',
  ai_generated boolean not null default false,
  status public.item_status not null default 'borrador',
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;
create policy "Staff ve informes" on public.reports for select to authenticated using (center_id = public.current_center_id() and public.is_staff());
create policy "Staff crea informes" on public.reports for insert to authenticated with check (center_id = public.current_center_id() and public.is_staff());
create policy "Staff edita informes" on public.reports for update to authenticated using (center_id = public.current_center_id() and public.is_staff()) with check (center_id = public.current_center_id());
create policy "Staff borra informes" on public.reports for delete to authenticated using (center_id = public.current_center_id() and public.is_staff());

-- consistency + approval integrity
create or replace function public.child_guard()
returns trigger language plpgsql security definer set search_path = public as $$
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
  -- approval fields can only be set via approve_item
  if tg_op = 'INSERT' then
    if tg_table_name <> 'activity_results' then
      new.approved_by := null; new.approved_at := null;
      if new.status = 'aprobado' and new.ai_generated then new.status := 'borrador'; end if;
    end if;
  elsif tg_table_name <> 'activity_results' and current_setting('programiza.approving', true) is distinct from 'on' then
    new.approved_by := old.approved_by; new.approved_at := old.approved_at;
    if new.status = 'aprobado' and old.status = 'borrador' then new.status := 'borrador'; end if;
  end if;
  return new;
end $$;
create trigger plan_objectives_guard before insert or update on public.plan_objectives for each row execute function public.child_guard();
create trigger activity_results_guard before insert or update on public.activity_results for each row execute function public.child_guard();
create trigger reports_guard before insert or update on public.reports for each row execute function public.child_guard();

create or replace function public.activities_approval_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.approved_by := null; new.approved_at := null;
    if new.ai_generated then new.status := 'borrador'; end if;
  elsif current_setting('programiza.approving', true) is distinct from 'on' then
    new.approved_by := old.approved_by; new.approved_at := old.approved_at;
    if new.status = 'aprobado' and old.status = 'borrador' then new.status := 'borrador'; end if;
  end if;
  return new;
end $$;
create trigger plan_activities_approval before insert or update on public.plan_activities for each row execute function public.activities_approval_guard();

create or replace function public.approve_item(_kind text, _id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c uuid := public.current_center_id(); pid uuid;
begin
  if c is null or not public.is_staff() then raise exception 'Sin acceso'; end if;
  perform set_config('programiza.approving', 'on', true);
  if _kind = 'objetivo' then
    update public.plan_objectives set status='aprobado', approved_by=auth.uid(), approved_at=now() where id=_id and center_id=c;
  elsif _kind = 'actividad' then
    update public.plan_activities set status='aprobado', approved_by=auth.uid(), approved_at=now() where id=_id and center_id=c;
  elsif _kind = 'informe' then
    update public.reports set status='aprobado', approved_by=auth.uid(), approved_at=now() where id=_id and center_id=c returning person_id into pid;
  else raise exception 'Tipo no válido'; end if;
  if not found then raise exception 'Elemento no encontrado'; end if;
  perform set_config('programiza.approving', 'off', true);
end $$;
revoke execute on function public.approve_item from anon, public;
grant execute on function public.approve_item to authenticated;

create or replace function public.log_access(_person_id uuid, _action text)
returns void language plpgsql security definer set search_path = public as $$
declare c uuid := public.current_center_id(); pcode text;
begin
  if c is null or not public.is_staff() then raise exception 'Sin acceso'; end if;
  if _action not in ('abrir','editar','crear','exportar','anonimizar','eliminar','sugerencia_ia','seguimiento','informe','exportar_pdf','ver_evolucion') then raise exception 'Acción no válida'; end if;
  select code into pcode from public.persons where id = _person_id and center_id = c;
  if pcode is null then raise exception 'Persona no encontrada'; end if;
  insert into public.access_logs(center_id,user_id,person_id,person_code,action) values (c, auth.uid(), _person_id, pcode, _action);
end $$;
