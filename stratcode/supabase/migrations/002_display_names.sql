create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, 'Solver ' || substr(new.id::text, 1, 4));
  return new;
end;
$$;

-- Replace any existing email-derived names
update public.profiles
set display_name = 'Solver ' || substr(id::text, 1, 4)
where display_name is null or display_name !~ '^Solver ';
