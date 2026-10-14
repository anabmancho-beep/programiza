create or replace function public.regenerate_join_code()
returns text language plpgsql security definer set search_path = public as $$
declare c uuid := public.current_center_id(); nc text;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Solo el administrador'; end if;
  nc := upper(substr(md5(gen_random_uuid()::text),1,8));
  update public.centers set join_code = nc where id = c;
  return nc;
end $$;
revoke execute on function public.regenerate_join_code from anon, public;
grant execute on function public.regenerate_join_code to authenticated;