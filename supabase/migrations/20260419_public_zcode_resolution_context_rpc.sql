create or replace function public.fn_set_enrollee_z_code_resolution_context(
  p_enrollee_z_code_id uuid,
  p_is_resolved boolean,
  p_partner_id uuid,
  p_resolution_note text
)
returns table(
  enrollee_z_code_id uuid,
  is_resolved boolean,
  resolution_at timestamptz,
  resolution_partner_id uuid,
  resolution_partner_name text,
  resolution_note text
)
language plpgsql
security definer
set search_path = atlas, public
as $$
begin
  return query
  update atlas.enrollee_z_codes ez
  set
    is_resolved = p_is_resolved,
    resolution_at = case when p_is_resolved then now() else null end,
    resolution_partner_id = case when p_is_resolved then p_partner_id else null end,
    resolution_note = case when p_is_resolved then nullif(btrim(p_resolution_note), '') else null end
  where ez.id = p_enrollee_z_code_id
    and ez.ended_at is null
  returning
    ez.id,
    ez.is_resolved,
    ez.resolution_at,
    ez.resolution_partner_id,
    (
      select p.organization_name
      from atlas.partners p
      where p.id = ez.resolution_partner_id
    ),
    ez.resolution_note;
end;
$$;

grant execute on function public.fn_set_enrollee_z_code_resolution_context(uuid, boolean, uuid, text) to anon, authenticated;
notify pgrst, 'reload schema';
