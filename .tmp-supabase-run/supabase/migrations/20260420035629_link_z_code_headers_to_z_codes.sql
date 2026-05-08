do $$
declare
  z_codes_group_type text;
  z_headers_group_type text;
  constraint_exists boolean;
begin
  if to_regclass('atlas.z_codes') is null or to_regclass('atlas.z_code_headers') is null then
    return;
  end if;

  select data_type
  into z_codes_group_type
  from information_schema.columns
  where table_schema = 'atlas'
    and table_name = 'z_codes'
    and column_name = 'z_group';

  select data_type
  into z_headers_group_type
  from information_schema.columns
  where table_schema = 'atlas'
    and table_name = 'z_code_headers'
    and column_name = 'z_group';

  if z_codes_group_type is null or z_headers_group_type is null then
    return;
  end if;

  if z_codes_group_type <> z_headers_group_type then
    return;
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'atlas'
      and tablename = 'z_code_headers'
      and indexname = 'ix_z_code_headers_z_group'
  ) then
    execute 'create index ix_z_code_headers_z_group on atlas.z_code_headers (z_group)';
  end if;

  select exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'atlas'
      and table_name = 'z_codes'
      and constraint_name = 'fk_z_codes_z_group_header'
      and constraint_type = 'FOREIGN KEY'
  )
  into constraint_exists;

  if not constraint_exists then
    execute 'alter table atlas.z_codes add constraint fk_z_codes_z_group_header foreign key (z_group) references atlas.z_code_headers (z_group)';
  end if;
end $$;;
