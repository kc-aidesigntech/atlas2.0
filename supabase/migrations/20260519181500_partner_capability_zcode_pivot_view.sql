-- Build a wide partner capability report so each z-code can be compared side-by-side.
-- Positive values indicate specialize strength, negative values indicate interfere strength.
do $$
declare
  capability_columns text;
  create_view_sql text;
begin
  select
    string_agg(
      format(
        '  max(case when z.id = %L then
      case
        when pzc.is_active is not true then null
        when pzc.relation_type = ''specialize'' then pzc.strength
        when pzc.relation_type = ''interfere'' then -pzc.strength
        else null
      end
    end) as %I',
        z.id,
        'z_' ||
          regexp_replace(lower(z.z_code), '[^a-z0-9]+', '_', 'g') ||
          '__' ||
          left(regexp_replace(lower(coalesce(z.title, 'untitled')), '[^a-z0-9]+', '_', 'g'), 24)
      ),
      E',\n'
      order by z.z_code
    )
  into capability_columns
  from atlas.z_codes z
  where z.is_active = true;

  if capability_columns is null then
    capability_columns := '  null::numeric as no_active_z_codes';
  end if;

  create_view_sql := format(
$view$
create or replace view atlas.v_partner_service_capacity_profile_pivot as
select
  p.id as partner_id,
  p.organization_name,
%s
from atlas.partners p
left join atlas.partner_z_code_capabilities pzc
  on pzc.partner_id = p.id
left join atlas.z_codes z
  on z.id = pzc.z_code_id
group by p.id, p.organization_name
order by p.organization_name;
$view$,
    capability_columns
  );

  execute create_view_sql;
end $$;

comment on view atlas.v_partner_service_capacity_profile_pivot is
  'Pivoted partner z-code capability profile. Positive values represent specialize strength and negative values represent interfere strength.';

grant select on atlas.v_partner_service_capacity_profile_pivot to authenticated;
