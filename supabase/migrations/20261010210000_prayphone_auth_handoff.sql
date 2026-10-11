-- One-time door from the Atlas workspace into the Pray Phone agent.
-- The two apps are different sites, so the agent cannot read the Atlas
-- browser session. This row is a 60-second code, not the session itself.
-- The agent server consumes it once and then signs the same Supabase user in.

create table if not exists atlas.prayphone_auth_handoffs (
  code text primary key,
  user_id uuid not null,
  expires_at timestamptz not null,
  consumed_at timestamptz
);

alter table atlas.prayphone_auth_handoffs enable row level security;

revoke all on table atlas.prayphone_auth_handoffs from public, anon, authenticated;

create or replace function atlas.fn_create_prayphone_handoff()
returns text
language plpgsql
volatile
security definer
set search_path = atlas, public
as $$
declare
  next_code text;
begin
  if auth.uid() is null or not atlas.fn_can_access_warmline_agent() then
    raise exception 'warm line access required' using errcode = '42501';
  end if;

  -- Two UUIDs, hex only. The code is the only value that may appear in the
  -- browser address bar, and only until the agent page strips it.
  next_code := replace(extensions.gen_random_uuid()::text, '-', '') || replace(extensions.gen_random_uuid()::text, '-', '');

  insert into atlas.prayphone_auth_handoffs (code, user_id, expires_at)
  values (next_code, auth.uid(), now() + interval '60 seconds');

  delete from atlas.prayphone_auth_handoffs
  where expires_at < now() - interval '1 day';

  return next_code;
end;
$$;

create or replace function atlas.fn_consume_prayphone_handoff(target_code text)
returns uuid
language plpgsql
volatile
security definer
set search_path = atlas, public
as $$
declare
  found_user uuid;
begin
  if target_code is null or target_code !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  update atlas.prayphone_auth_handoffs
  set consumed_at = now()
  where code = target_code
    and consumed_at is null
    and expires_at > now()
  returning user_id into found_user;

  return found_user;
end;
$$;

revoke all on function atlas.fn_create_prayphone_handoff() from public;
grant execute on function atlas.fn_create_prayphone_handoff() to authenticated;

revoke all on function atlas.fn_consume_prayphone_handoff(text) from public, anon, authenticated;
grant execute on function atlas.fn_consume_prayphone_handoff(text) to service_role;

comment on table atlas.prayphone_auth_handoffs is
  'Single-use codes that let the Pray Phone agent sign in the same Supabase user who clicked the Atlas phone icon. Codes are not session tokens.';
