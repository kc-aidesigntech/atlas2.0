do $$
declare
  z_codes_group_type text;
  z_headers_group_type text;
  has_z_code_key boolean;
  duplicate_groups integer;
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

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'atlas'
      and table_name = 'z_code_headers'
      and column_name = 'z_code_key'
  )
  into has_z_code_key;

  if z_headers_group_type is null and has_z_code_key then
    execute 'alter table atlas.z_code_headers add column z_group integer';
    execute 'update atlas.z_code_headers set z_group = z_code_key where z_group is null';
    z_headers_group_type := 'integer';
  end if;

  if z_codes_group_type is null or z_headers_group_type is null then
    return;
  end if;

  if z_codes_group_type <> z_headers_group_type then
    return;
  end if;

  select count(*)
  into duplicate_groups
  from (
    select z_group
    from atlas.z_code_headers
    where z_group is not null
    group by z_group
    having count(*) > 1
  ) duplicated;

  if duplicate_groups > 0 then
    return;
  end if;

  if has_z_code_key then
    execute '
      insert into atlas.z_code_headers (z_code_key, z_group, z_code_hdr_desc)
      select distinct z.z_group, z.z_group, ''''
      from atlas.z_codes z
      left join atlas.z_code_headers h
        on h.z_group = z.z_group
      where z.z_group is not null
        and h.z_group is null
    ';
  else
    execute '
      insert into atlas.z_code_headers (z_group, z_code_hdr_desc)
      select distinct z.z_group, ''''
      from atlas.z_codes z
      left join atlas.z_code_headers h
        on h.z_group = z.z_group
      where z.z_group is not null
        and h.z_group is null
    ';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'atlas'
      and tablename = 'z_code_headers'
      and indexname = 'ux_z_code_headers_z_group'
  ) then
    execute 'create unique index ux_z_code_headers_z_group on atlas.z_code_headers (z_group)';
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
end $$;
