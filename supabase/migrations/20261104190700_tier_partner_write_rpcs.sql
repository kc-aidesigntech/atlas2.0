-- Partner write Remote Procedure Calls (RPCs) for the tier permission keys.
--
-- atlas.partner_stations and atlas.route_plan_stops grant no insert / update to
-- authenticated and their write policies are *_admin_all, so the Partners panel
-- could only save as a system admin. Two security definer RPCs gate the two
-- writes the panel makes on partner_profile.write and partner_milestones.write
-- (seeded to t4plus in 20261104190300_tier_permissions.sql).
--
-- Also: atlas.fn_access_matrix_save_person_roles closes removed assignments
-- with ends_on = current_date - 1, matching the tier closers in
-- 20261104190600_tier_followups.sql under the inclusive ends_on read.

-- ---------------------------------------------------------------------------
-- fn_update_partner_station
-- ---------------------------------------------------------------------------

-- Updates station_name, capacity_total, and capacity_available on one
-- atlas.partner_stations row from the payload keys present; other keys are
-- ignored. Returns the updated row as JavaScript Object Notation (JSON).
create or replace function atlas.fn_update_partner_station(target_station_id uuid, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  v_payload jsonb := coalesce(payload, '{}'::jsonb);
  v_station_name text;
  v_capacity_total integer;
  v_capacity_available integer;
  v_row atlas.partner_stations%rowtype;
begin
  -- Raises unless the caller is a system admin or holds partner_profile.write.
  if not (atlas.fn_is_system_admin() or atlas.fn_has_permission('partner_profile.write')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if target_station_id is null then
    raise exception 'target_station_id is required' using errcode = '22023';
  end if;
  if jsonb_typeof(v_payload) <> 'object' then
    raise exception 'payload must be a JSON object' using errcode = '22023';
  end if;

  -- Reads the three whitelisted keys; a present key with an unusable value raises.
  if v_payload ? 'station_name' then
    v_station_name := nullif(btrim(v_payload ->> 'station_name'), '');
    if v_station_name is null then
      raise exception 'station_name cannot be empty' using errcode = '22023';
    end if;
  end if;
  if v_payload ? 'capacity_total' then
    v_capacity_total := nullif(v_payload ->> 'capacity_total', '')::integer;
    if v_capacity_total is null or v_capacity_total < 0 then
      raise exception 'capacity_total must be a non-negative integer' using errcode = '22023';
    end if;
  end if;
  if v_payload ? 'capacity_available' then
    v_capacity_available := nullif(v_payload ->> 'capacity_available', '')::integer;
    if v_capacity_available is null or v_capacity_available < 0 then
      raise exception 'capacity_available must be a non-negative integer' using errcode = '22023';
    end if;
  end if;

  -- Writes only the keys that were present; absent keys keep the stored value.
  update atlas.partner_stations ps
  set
    station_name = coalesce(v_station_name, ps.station_name),
    capacity_total = coalesce(v_capacity_total, ps.capacity_total),
    capacity_available = coalesce(v_capacity_available, ps.capacity_available)
  where ps.id = target_station_id
  returning ps.* into v_row;

  if not found then
    raise exception 'partner station not found' using errcode = 'P0002';
  end if;

  return to_jsonb(v_row);
end;
$$;

revoke all on function atlas.fn_update_partner_station(uuid, jsonb) from public;
grant execute on function atlas.fn_update_partner_station(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- fn_set_route_plan_stop_status
-- ---------------------------------------------------------------------------

-- Sets status on one atlas.route_plan_stops row. The accepted values are the
-- ones in route_plan_stops_status_check; the table has no updated_at column.
-- Returns the updated row as JSON.
create or replace function atlas.fn_set_route_plan_stop_status(target_stop_id uuid, next_status text)
returns jsonb
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  v_status text := lower(btrim(coalesce(next_status, '')));
  v_row atlas.route_plan_stops%rowtype;
begin
  -- Raises unless the caller is a system admin or holds partner_milestones.write.
  if not (atlas.fn_is_system_admin() or atlas.fn_has_permission('partner_milestones.write')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if target_stop_id is null then
    raise exception 'target_stop_id is required' using errcode = '22023';
  end if;
  if v_status not in ('planned', 'active', 'completed', 'blocked') then
    raise exception 'unknown stop status %, expected planned | active | completed | blocked', next_status
      using errcode = '22023';
  end if;

  update atlas.route_plan_stops rps
  set status = v_status
  where rps.id = target_stop_id
  returning rps.* into v_row;

  if not found then
    raise exception 'route plan stop not found' using errcode = 'P0002';
  end if;

  return to_jsonb(v_row);
end;
$$;

revoke all on function atlas.fn_set_route_plan_stop_status(uuid, text) from public;
grant execute on function atlas.fn_set_route_plan_stop_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- fn_access_matrix_save_person_roles: closes removed assignments as of yesterday.
-- ---------------------------------------------------------------------------

-- Replaces a person's active role assignments with target_role_keys and marks
-- the highest-ranked tier key (atlas.fn_tier_rank) as primary; when no key is a
-- tier key, the alphabetically first key is primary.
create or replace function atlas.fn_access_matrix_save_person_roles(
  target_person_id uuid,
  target_role_keys text[]
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  normalized_keys text[] := coalesce(target_role_keys, '{}'::text[]);
  next_role_ids uuid[] := '{}'::uuid[];
  primary_role_id uuid;
begin
  perform atlas.fn_require_admin_claim();

  -- Legacy literals in the request map to their tier keys before lookup.
  select coalesce(array_agg(distinct atlas.fn_normalize_role_key(k.role_key)), '{}'::text[])
  into normalized_keys
  from unnest(normalized_keys) as k(role_key);

  select coalesce(array_agg(r.id), '{}'::uuid[])
  into next_role_ids
  from atlas.roles r
  where r.role_key = any(normalized_keys);

  -- Open assignments not in the request close with ends_on = yesterday, so the
  -- inclusive reads (ends_on >= current_date) stop counting them today.
  update atlas.people_role_assignments pra
  set ends_on = current_date - 1, is_primary = false
  where pra.person_id = target_person_id
    and pra.ends_on is null
    and (
      array_length(next_role_ids, 1) is null
      or not (pra.role_id = any(next_role_ids))
    );

  -- Inserts an open assignment for each requested role the person does not
  -- already hold open. The unnest alias is qualified so the subquery compares
  -- pra.role_id against the requested role, not against itself.
  insert into atlas.people_role_assignments (id, person_id, role_id, is_primary, starts_on, ends_on)
  select gen_random_uuid(), target_person_id, next_role.role_id, false, current_date, null
  from unnest(next_role_ids) as next_role(role_id)
  where not exists (
    select 1
    from atlas.people_role_assignments pra
    where pra.person_id = target_person_id
      and pra.role_id = next_role.role_id
      and pra.ends_on is null
  );

  update atlas.people_role_assignments
  set is_primary = false
  where person_id = target_person_id
    and ends_on is null;

  -- Highest tier rank wins; rank 0 keys (partner, enrollee) sort after tiers
  -- and then alphabetically.
  select r.id
  into primary_role_id
  from atlas.roles r
  where r.role_key = any(normalized_keys)
  order by atlas.fn_tier_rank(r.role_key) desc, r.role_key asc
  limit 1;

  if primary_role_id is not null then
    update atlas.people_role_assignments
    set is_primary = true
    where person_id = target_person_id
      and role_id = primary_role_id
      and ends_on is null;
  end if;
end;
$$;

notify pgrst, 'reload schema';
