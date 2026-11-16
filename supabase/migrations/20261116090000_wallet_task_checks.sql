-- My Wallet task pad: the tasks a person has checked.
--
-- One row per check. `task_key` is the task's id, which names the task and
-- the period it belongs to (a week for a form task, a day for a pickup task).
-- `task` is the task as it read when it was checked, in JavaScript Object
-- Notation (JSON), so the completed list prints it after it stops being due.
--
-- A check made today is unchecked by deleting its row. A check from an earlier
-- day is unchecked by writing `reopened_at` and `reopen_reason`; the row stays.
--
-- Row-Level Security (RLS): a person reads and writes their own rows, and
-- needs `wallet.access` to do so. There is no administrator policy; nobody
-- reads another person's checks through this table.

create table if not exists atlas.wallet_task_checks (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null default atlas.fn_current_person_id() references atlas.people(id) on delete cascade,
  task_key text not null check (length(btrim(task_key)) > 0),
  task jsonb not null check (jsonb_typeof(task) = 'object'),
  done_at timestamptz not null default now(),
  reopened_at timestamptz,
  reopen_reason text,
  created_at timestamptz not null default now(),
  constraint wallet_task_checks_reopen_reason_check check (
    (reopened_at is null and reopen_reason is null)
    or (reopened_at is not null and length(btrim(reopen_reason)) > 0)
  )
);

comment on table atlas.wallet_task_checks is
  'Tasks a person checked on the My Wallet task pad (wallet.access, own rows only).';
comment on column atlas.wallet_task_checks.task_key is
  'The task id: the task and the week or day it belongs to.';
comment on column atlas.wallet_task_checks.task is
  'The task as it read when it was checked.';
comment on column atlas.wallet_task_checks.reopened_at is
  'Set when a check from an earlier day is unchecked; reopen_reason holds the reason given.';

-- One open check per person and task.
create unique index if not exists idx_wallet_task_checks_open
  on atlas.wallet_task_checks(person_id, task_key)
  where reopened_at is null;

create index if not exists idx_wallet_task_checks_person_done
  on atlas.wallet_task_checks(person_id, done_at desc);

alter table atlas.wallet_task_checks enable row level security;

drop policy if exists wallet_task_checks_self_select on atlas.wallet_task_checks;
create policy wallet_task_checks_self_select on atlas.wallet_task_checks
  for select to authenticated
  using (person_id = atlas.fn_current_person_id() and atlas.fn_has_permission('wallet.access'));

drop policy if exists wallet_task_checks_self_insert on atlas.wallet_task_checks;
create policy wallet_task_checks_self_insert on atlas.wallet_task_checks
  for insert to authenticated
  with check (person_id = atlas.fn_current_person_id() and atlas.fn_has_permission('wallet.access'));

drop policy if exists wallet_task_checks_self_update on atlas.wallet_task_checks;
create policy wallet_task_checks_self_update on atlas.wallet_task_checks
  for update to authenticated
  using (person_id = atlas.fn_current_person_id() and atlas.fn_has_permission('wallet.access') and reopened_at is null)
  with check (person_id = atlas.fn_current_person_id() and atlas.fn_has_permission('wallet.access'));

-- The delete is the no-reason uncheck of a check made the same day, so it
-- accepts an open check at most 24 hours old. An older check is unchecked
-- through the update above, which stores the reason.
drop policy if exists wallet_task_checks_self_delete on atlas.wallet_task_checks;
create policy wallet_task_checks_self_delete on atlas.wallet_task_checks
  for delete to authenticated
  using (
    person_id = atlas.fn_current_person_id()
    and atlas.fn_has_permission('wallet.access')
    and reopened_at is null
    and done_at > now() - interval '24 hours'
  );

-- `authenticated` inserts only the task columns (the person and the check time
-- come from the column defaults) and updates only the two reopen columns.
revoke all on table atlas.wallet_task_checks from public, anon, authenticated;
grant select, delete on table atlas.wallet_task_checks to authenticated;
grant insert (task_key, task) on table atlas.wallet_task_checks to authenticated;
grant update (reopened_at, reopen_reason) on table atlas.wallet_task_checks to authenticated;
grant select, insert, update, delete on table atlas.wallet_task_checks to service_role;
