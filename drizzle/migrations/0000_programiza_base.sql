
create type public.app_role as enum ('admin','educador','profesional','familia');
create type public.consent_status as enum ('pendiente','otorgado','retirado');
create type public.plan_level as enum ('anual','mensual','semanal','diaria');

create table public.centers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  join_code text not null unique default upper(substr(md5(gen_random_uuid()::text),1,8)),
  created_by uuid not null,
  created_at timestamptz not null default now()
);
grant select on public.centers to authenticated;
grant all on public.centers to service_role;
alter table public.centers enable row level security;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  center_id uuid references public.centers(id) on delete set null,
  display_name text,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  center_id uuid not null references public.centers(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, center_id)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

-- helpers (security definer, no recursion)
create or replace function public.current_center_id()
returns uuid language sql stable security definer set search_path = public as $$
  select center_id from public.profiles where id = auth.uid()
$$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id and p.center_id = ur.center_id
                 where ur.user_id = _user_id and ur.role = _role)
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id and p.center_id = ur.center_id
                 where ur.user_id = auth.uid() and ur.role in ('admin','educador','profesional'))
$$;

create policy "Ver mi centro" on public.centers for select to authenticated using (id = public.current_center_id());
create policy "Ver perfiles del centro" on public.profiles for select to authenticated
  using (id = auth.uid() or center_id = public.current_center_id());
create policy "Editar mi nombre" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and center_id is not distinct from public.current_center_id());
create policy "Ver roles del centro" on public.user_roles for select to authenticated
  using (center_id = public.current_center_id());

-- profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- persons
create table public.persons (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  code text not null check (char_length(code) between 1 and 20),
  age_range text not null,
  main_type text not null,
  diagnosis text check (diagnosis is null or char_length(diagnosis) <= 1000),
  autonomy jsonb not null default '{}'::jsonb,
  supports text, communication text, likes text, sensitivities text, routines text,
  consent_status public.consent_status not null default 'pendiente',
  consent_grantor text,
  consent_date date,
  consent_purpose text,
  anonymized boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (center_id, code)
);
grant select, insert, update, delete on public.persons to authenticated;
grant all on public.persons to service_role;
alter table public.persons enable row level security;
create policy "Staff ve personas del centro" on public.persons for select to authenticated using (center_id = public.current_center_id() and public.is_staff());
create policy "Staff crea personas" on public.persons for insert to authenticated with check (center_id = public.current_center_id() and public.is_staff());
create policy "Staff edita personas" on public.persons for update to authenticated using (center_id = public.current_center_id() and public.is_staff()) with check (center_id = public.current_center_id());
create policy "Admin elimina personas" on public.persons for delete to authenticated using (center_id = public.current_center_id() and public.has_role(auth.uid(),'admin'));

create or replace function public.persons_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.consent_status <> 'otorgado' and new.diagnosis is not null and new.diagnosis <> ''
     and (tg_op = 'INSERT' or new.diagnosis is distinct from old.diagnosis) then
    raise exception 'No se puede guardar el diagnóstico sin consentimiento otorgado';
  end if;
  if new.consent_status = 'otorgado' and (new.consent_grantor is null or new.consent_date is null or coalesce(new.consent_purpose,'') = '') then
    raise exception 'El consentimiento otorgado requiere quién lo otorga, fecha y finalidad';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger persons_guard before insert or update on public.persons for each row execute function public.persons_guard();

-- plans
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  person_id uuid references public.persons(id) on delete cascade,
  parent_id uuid references public.plans(id) on delete set null,
  level public.plan_level not null,
  title text not null check (char_length(title) between 1 and 160),
  objectives text,
  start_date date,
  end_date date,
  is_template boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.plans to authenticated;
grant all on public.plans to service_role;
alter table public.plans enable row level security;
create policy "Staff ve programaciones" on public.plans for select to authenticated using (center_id = public.current_center_id() and public.is_staff());
create policy "Staff crea programaciones" on public.plans for insert to authenticated with check (center_id = public.current_center_id() and public.is_staff());
create policy "Staff edita programaciones" on public.plans for update to authenticated using (center_id = public.current_center_id() and public.is_staff()) with check (center_id = public.current_center_id());
create policy "Staff elimina programaciones" on public.plans for delete to authenticated using (center_id = public.current_center_id() and public.is_staff());

create or replace function public.plans_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare st public.consent_status; pc uuid; pl public.plan_level; pp uuid;
begin
  if new.person_id is not null then
    select consent_status, center_id into st, pc from public.persons where id = new.person_id;
    if pc is distinct from new.center_id then raise exception 'Persona de otro centro'; end if;
    if st <> 'otorgado' then raise exception 'No se pueden crear programaciones sin consentimiento otorgado'; end if;
  end if;
  if new.parent_id is not null then
    select level, person_id into pl, pp from public.plans where id = new.parent_id and center_id = new.center_id;
    if pl is null then raise exception 'Programación superior no válida'; end if;
    if not ((new.level='mensual' and pl='anual') or (new.level='semanal' and pl='mensual') or (new.level='diaria' and pl='semanal')) then
      raise exception 'El nivel superior no corresponde';
    end if;
  elsif new.level <> 'anual' and not new.is_template then
    raise exception 'Esta programación debe enlazarse con una de nivel superior';
  end if;
  return new;
end $$;
create trigger plans_guard before insert or update on public.plans for each row execute function public.plans_guard();

create table public.plan_activities (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  area text not null,
  duration_min int check (duration_min is null or duration_min between 1 and 600),
  support_level text,
  materials text,
  steps text[] not null default '{}',
  adaptations text,
  day_of_week int check (day_of_week is null or day_of_week between 1 and 7),
  time_slot text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.plan_activities to authenticated;
grant all on public.plan_activities to service_role;
alter table public.plan_activities enable row level security;
create policy "Staff ve actividades" on public.plan_activities for select to authenticated using (center_id = public.current_center_id() and public.is_staff());
create policy "Staff crea actividades" on public.plan_activities for insert to authenticated with check (center_id = public.current_center_id() and public.is_staff());
create policy "Staff edita actividades" on public.plan_activities for update to authenticated using (center_id = public.current_center_id() and public.is_staff()) with check (center_id = public.current_center_id());
create policy "Staff elimina actividades" on public.plan_activities for delete to authenticated using (center_id = public.current_center_id() and public.is_staff());

-- activity bank (center_id null = generic library)
create table public.activity_bank (
  id uuid primary key default gen_random_uuid(),
  center_id uuid references public.centers(id) on delete cascade,
  title text not null, area text not null, duration_min int, support_level text,
  materials text, steps text[] not null default '{}', adaptations text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.activity_bank to authenticated;
grant all on public.activity_bank to service_role;
alter table public.activity_bank enable row level security;
create policy "Ver banco" on public.activity_bank for select to authenticated using (center_id is null or center_id = public.current_center_id());
create policy "Staff añade al banco" on public.activity_bank for insert to authenticated with check (center_id = public.current_center_id() and public.is_staff());
create policy "Staff edita banco del centro" on public.activity_bank for update to authenticated using (center_id = public.current_center_id() and public.is_staff()) with check (center_id = public.current_center_id());
create policy "Staff borra banco del centro" on public.activity_bank for delete to authenticated using (center_id = public.current_center_id() and public.is_staff());

-- access log
create table public.access_logs (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  user_id uuid not null,
  person_id uuid,
  person_code text,
  action text not null,
  created_at timestamptz not null default now()
);
grant select on public.access_logs to authenticated;
grant all on public.access_logs to service_role;
alter table public.access_logs enable row level security;
create policy "Admin ve registro" on public.access_logs for select to authenticated using (center_id = public.current_center_id() and public.has_role(auth.uid(),'admin'));

create or replace function public.log_access(_person_id uuid, _action text)
returns void language plpgsql security definer set search_path = public as $$
declare c uuid := public.current_center_id(); pcode text;
begin
  if c is null or not public.is_staff() then raise exception 'Sin acceso'; end if;
  if _action not in ('abrir','editar','crear','exportar','anonimizar','eliminar') then raise exception 'Acción no válida'; end if;
  select code into pcode from public.persons where id = _person_id and center_id = c;
  if pcode is null then raise exception 'Persona no encontrada'; end if;
  insert into public.access_logs(center_id,user_id,person_id,person_code,action) values (c, auth.uid(), _person_id, pcode, _action);
end $$;

-- center creation / joining / roles
create or replace function public.create_center(_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if public.current_center_id() is not null then raise exception 'Ya perteneces a un centro'; end if;
  if char_length(trim(_name)) < 2 then raise exception 'Nombre demasiado corto'; end if;
  insert into public.centers(name, created_by) values (trim(_name), auth.uid()) returning id into cid;
  update public.profiles set center_id = cid where id = auth.uid();
  insert into public.user_roles(user_id, center_id, role) values (auth.uid(), cid, 'admin');
  return cid;
end $$;

create or replace function public.join_center(_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if public.current_center_id() is not null then raise exception 'Ya perteneces a un centro'; end if;
  select id into cid from public.centers where join_code = upper(trim(_code));
  if cid is null then raise exception 'Código de centro no válido'; end if;
  update public.profiles set center_id = cid where id = auth.uid();
  insert into public.user_roles(user_id, center_id, role) values (auth.uid(), cid, 'educador');
  return cid;
end $$;

create or replace function public.assign_role(_user_id uuid, _role public.app_role)
returns void language plpgsql security definer set search_path = public as $$
declare c uuid := public.current_center_id();
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Solo el administrador puede asignar roles'; end if;
  if _user_id = auth.uid() then raise exception 'No puedes cambiar tu propio rol'; end if;
  update public.user_roles set role = _role where user_id = _user_id and center_id = c;
  if not found then raise exception 'Usuario no pertenece al centro'; end if;
end $$;

-- GDPR
create or replace function public.export_person(_person_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c uuid := public.current_center_id(); r jsonb;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Solo el administrador'; end if;
  select jsonb_build_object(
    'persona', to_jsonb(p) - 'center_id',
    'programaciones', coalesce((select jsonb_agg(to_jsonb(pl) - 'center_id') from public.plans pl where pl.person_id = p.id), '[]'::jsonb),
    'actividades', coalesce((select jsonb_agg(to_jsonb(a) - 'center_id') from public.plan_activities a join public.plans pl on pl.id = a.plan_id where pl.person_id = p.id), '[]'::jsonb),
    'registro_accesos', coalesce((select jsonb_agg(to_jsonb(l) - 'center_id') from public.access_logs l where l.person_id = p.id), '[]'::jsonb),
    'exportado_en', now()
  ) into r from public.persons p where p.id = _person_id and p.center_id = c;
  if r is null then raise exception 'Persona no encontrada'; end if;
  perform public.log_access(_person_id, 'exportar');
  return r;
end $$;

create or replace function public.anonymize_person(_person_id uuid)
returns void language plpgsql security definer set search_path = public as $$
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
  update public.access_logs set person_code = null where person_id = _person_id;
end $$;

create or replace function public.duplicate_week(_plan_id uuid, _new_start date)
returns uuid language plpgsql security invoker set search_path = public as $$
declare src public.plans; nid uuid;
begin
  select * into src from public.plans where id = _plan_id;
  if src.id is null or src.level <> 'semanal' then raise exception 'Solo se pueden duplicar semanas'; end if;
  insert into public.plans(center_id, person_id, parent_id, level, title, objectives, start_date, end_date, is_template, created_by)
  values (src.center_id, src.person_id, src.parent_id, 'semanal', src.title || ' (copia)', src.objectives, _new_start, _new_start + 6, src.is_template, auth.uid())
  returning id into nid;
  insert into public.plan_activities(center_id, plan_id, title, area, duration_min, support_level, materials, steps, adaptations, day_of_week, time_slot, position)
  select center_id, nid, title, area, duration_min, support_level, materials, steps, adaptations, day_of_week, time_slot, position
  from public.plan_activities where plan_id = _plan_id;
  return nid;
end $$;

revoke execute on function public.create_center, public.join_center, public.assign_role, public.export_person, public.anonymize_person, public.log_access, public.duplicate_week from anon, public;
grant execute on function public.create_center, public.join_center, public.assign_role, public.export_person, public.anonymize_person, public.log_access, public.duplicate_week to authenticated;

-- generic activity library (fictitious)
insert into public.activity_bank (title, area, duration_min, support_level, materials, steps, adaptations) values
('Cuidado del huerto: regar', 'naturaleza', 30, 'Supervisión', 'Regadera, guantes', array['Ponerse los guantes','Llenar la regadera hasta la marca','Regar cada bancal despacio','Guardar la regadera'], 'Marcar la regadera con color para el nivel de agua'),
('Siembra de semillas en semillero', 'naturaleza', 45, 'Apoyo parcial', 'Semillero, tierra, semillas grandes', array['Llenar los huecos con tierra','Hacer un agujero con el dedo','Poner una semilla','Tapar y etiquetar con pictograma'], 'Usar semillas grandes (habas) para facilitar la pinza'),
('Paseo sensorial por el jardín', 'naturaleza', 40, 'Apoyo parcial', 'Cesta, tarjetas de texturas', array['Elegir el recorrido con pictogramas','Tocar tres texturas distintas','Oler plantas aromáticas','Contar lo que más ha gustado'], 'Ruta accesible para silla de ruedas; auriculares si hay ruido'),
('Jardinería: trasplantar plantas aromáticas', 'naturaleza', 45, 'Apoyo parcial', 'Macetas, pala pequeña, tierra', array['Preparar la maceta nueva','Sacar la planta con cuidado','Colocarla y rellenar con tierra','Regar un poco'], 'Herramientas con mango engrosado'),
('Recogida de hojas y compostaje', 'naturaleza', 30, 'Supervisión', 'Rastrillo, cubo', array['Rastrillar una zona pequeña','Echar las hojas al cubo','Llevar el cubo al compostador'], NULL),
('Lavado de manos con secuencia visual', 'autonomia_personal', 10, 'Supervisión', 'Jabón, toalla, secuencia de pictogramas', array['Abrir el grifo','Mojar las manos','Poner jabón y frotar','Aclarar','Secar con la toalla'], 'Secuencia plastificada junto al lavabo'),
('Preparar un desayuno sencillo', 'autonomia_personal', 30, 'Apoyo parcial', 'Pan, tostadora, plato', array['Sacar los ingredientes','Tostar el pan con ayuda','Untar','Recoger la mesa'], 'Cuchillo de punta redonda'),
('Tablero de comunicación: elegir actividad', 'comunicacion', 15, 'Apoyo parcial', 'Tablero de pictogramas', array['Mostrar tres opciones','Esperar la elección','Confirmar y empezar'], 'Ampliar pictogramas para baja visión'),
('Círculo de saludo', 'habilidades_sociales', 15, 'Supervisión', 'Pelota blanda', array['Sentarse en círculo','Pasar la pelota y saludar','Decir cómo me siento hoy'], 'Permitir saludo con gesto o pictograma'),
('Clasificar objetos por color', 'cognitiva', 20, 'Apoyo parcial', 'Bandejas de colores, fichas', array['Mostrar el modelo','Clasificar 10 fichas','Revisar juntos'], 'Fichas grandes y con textura'),
('Circuito de motricidad gruesa', 'motricidad', 30, 'Apoyo total', 'Colchonetas, conos', array['Calentamiento','Recorrer el circuito','Estiramientos'], 'Adaptar recorrido a movilidad reducida'),
('Taller de música y ritmo', 'ocio', 40, 'Supervisión', 'Instrumentos de percusión', array['Elegir instrumento','Seguir el ritmo','Tocar en grupo'], 'Volumen moderado; zona tranquila disponible'),
('Taller de reciclaje de papel', 'ocupacional', 60, 'Apoyo parcial', 'Papel usado, cubeta, bastidor', array['Trocear el papel','Remojar','Formar la hoja en el bastidor','Dejar secar'], NULL);
