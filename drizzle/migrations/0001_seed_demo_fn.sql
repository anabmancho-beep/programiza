
create or replace function public.load_demo_data()
returns uuid language plpgsql security definer set search_path = public as $$
declare c uuid := public.current_center_id(); p1 uuid; p2 uuid; p3 uuid; a uuid; m uuid; w uuid; d uuid; wk date := date_trunc('week', now())::date;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if c is null then
    insert into public.centers(name, created_by) values ('Centro de día Los Olivos (demo)', auth.uid()) returning id into c;
    update public.profiles set center_id = c where id = auth.uid();
    insert into public.user_roles(user_id, center_id, role) values (auth.uid(), c, 'admin');
  elsif not public.has_role(auth.uid(),'admin') then
    raise exception 'Solo el administrador puede cargar datos de ejemplo';
  end if;
  if exists (select 1 from public.persons where center_id = c and code in ('P-014','P-021','P-033','P-047')) then
    raise exception 'Los datos de ejemplo ya están cargados';
  end if;

  insert into public.persons(center_id, code, age_range, main_type, diagnosis, autonomy, supports, communication, likes, sensitivities, routines, consent_status, consent_grantor, consent_date, consent_purpose, created_by)
  values (c,'P-014','26-35','psiquica','Discapacidad intelectual moderada (dato ficticio).',
    '{"higiene":"apoyo_parcial","alimentacion":"autonomo","movilidad":"autonomo","comunicacion":"apoyo_parcial","tareas_domesticas":"apoyo_parcial","ocio":"supervision","habilidades_sociales":"apoyo_parcial"}',
    'Secuencias visuales y anticipación de cambios','Frases cortas y pictogramas','Música, huerto, animales','Ruido fuerte','Desayuno a las 9:30, paseo tras la comida','otorgado','representante','2026-01-15','Planificación de apoyos y actividades en el centro', auth.uid())
  returning id into p1;
  insert into public.persons(center_id, code, age_range, main_type, autonomy, supports, communication, likes, sensitivities, routines, consent_status, consent_grantor, consent_date, consent_purpose, created_by)
  values (c,'P-021','36-45','fisica','{"higiene":"apoyo_total","alimentacion":"apoyo_parcial","movilidad":"apoyo_total","comunicacion":"autonomo","tareas_domesticas":"apoyo_total","ocio":"autonomo","habilidades_sociales":"autonomo"}',
    'Silla de ruedas, grúa para transferencias','Oral, sin dificultad','Lectura, juegos de mesa','Frío','Fisioterapia lunes y jueves','otorgado','persona','2026-02-03','Planificación de apoyos y actividades en el centro', auth.uid())
  returning id into p2;
  insert into public.persons(center_id, code, age_range, main_type, autonomy, supports, communication, likes, sensitivities, routines, consent_status, consent_grantor, consent_date, consent_purpose, created_by)
  values (c,'P-033','18-25','sensorial','{"higiene":"autonomo","alimentacion":"autonomo","movilidad":"supervision","comunicacion":"apoyo_parcial","tareas_domesticas":"supervision","ocio":"autonomo","habilidades_sociales":"supervision"}',
    'Bastón, señalización táctil','Lengua oral; textos en braille','Paseos, música','Luz intensa','Llegada a las 9:00','otorgado','persona','2026-03-10','Planificación de apoyos y actividades en el centro', auth.uid())
  returning id into p3;
  insert into public.persons(center_id, code, age_range, main_type, autonomy, consent_status, created_by)
  values (c,'P-047','46-55','neurodesarrollo','{}','pendiente', auth.uid());

  insert into public.plans(center_id, person_id, level, title, objectives, start_date, end_date, created_by)
  values (c,p1,'anual','Plan anual 2026 · P-014','Mejorar la autonomía en higiene personal.
Ampliar la comunicación con pictogramas.
Participar en el huerto del centro.', '2026-01-01','2026-12-31', auth.uid()) returning id into a;
  insert into public.plans(center_id, person_id, parent_id, level, title, objectives, start_date, end_date, created_by)
  values (c,p1,a,'mensual','Octubre · P-014','Lavado de manos autónomo con secuencia visual.
Elegir actividad con tablero de 3 opciones.', '2026-10-01','2026-10-31', auth.uid()) returning id into m;
  insert into public.plans(center_id, person_id, parent_id, level, title, objectives, start_date, end_date, created_by)
  values (c,p1,m,'semanal','Semana tipo · P-014','Rutina estable con huerto martes y jueves.', wk, wk+6, auth.uid()) returning id into w;
  insert into public.plan_activities(center_id, plan_id, title, area, duration_min, support_level, materials, steps, day_of_week, time_slot, position) values
  (c,w,'Círculo de saludo','habilidades_sociales',15,'Supervisión','Pelota blanda',array['Sentarse en círculo','Saludar','Decir cómo me siento'],1,'09:30',0),
  (c,w,'Cuidado del huerto: regar','naturaleza',30,'Supervisión','Regadera',array['Guantes','Llenar','Regar','Guardar'],2,'10:30',1),
  (c,w,'Taller de música y ritmo','ocio',40,'Supervisión','Percusión',array['Elegir instrumento','Seguir ritmo'],3,'11:00',2),
  (c,w,'Paseo sensorial por el jardín','naturaleza',40,'Apoyo parcial','Cesta',array['Elegir ruta','Tocar texturas','Oler plantas'],4,'10:30',3),
  (c,w,'Clasificar objetos por color','cognitiva',20,'Apoyo parcial','Bandejas',array['Ver modelo','Clasificar','Revisar'],5,'09:30',4);
  insert into public.plans(center_id, person_id, parent_id, level, title, objectives, start_date, end_date, created_by)
  values (c,p1,w,'diaria','Martes · P-014','Llegada tranquila y huerto.', wk+1, wk+1, auth.uid()) returning id into d;
  insert into public.plan_activities(center_id, plan_id, title, area, duration_min, support_level, materials, steps, adaptations, time_slot, position) values
  (c,d,'Lavado de manos con secuencia visual','autonomia_personal',10,'Supervisión','Secuencia de pictogramas',array['Abrir grifo','Mojar','Jabón','Aclarar','Secar'],'Pictogramas junto al lavabo','09:15',0),
  (c,d,'Desayuno','autonomia_personal',20,'Supervisión','',array['Sentarse','Desayunar','Recoger'],null,'09:30',1),
  (c,d,'Cuidado del huerto: regar','naturaleza',30,'Supervisión','Regadera, guantes',array['Guantes','Llenar regadera','Regar bancales','Guardar'],'Evitar horas de ruido de la máquina cortacésped','10:30',2);

  insert into public.plans(center_id, person_id, level, title, objectives, start_date, end_date, created_by)
  values (c,p2,'anual','Plan anual 2026 · P-021','Mantener movilidad de miembros superiores.
Participar en grupo de lectura.', '2026-01-01','2026-12-31', auth.uid());
  insert into public.plans(center_id, level, title, objectives, is_template, created_by)
  values (c,'semanal','Plantilla: semana con huerto','Semana estándar con dos sesiones de naturaleza.', true, auth.uid());
  return c;
end $$;
revoke execute on function public.load_demo_data from anon, public;
grant execute on function public.load_demo_data to authenticated;
