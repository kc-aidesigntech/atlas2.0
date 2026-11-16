-- My Wallet task pad: a reopened check always carries a reason.
--
-- The constraint written by 20261116090000_wallet_task_checks.sql compared
-- `length(btrim(reopen_reason)) > 0`. With `reopened_at` set and
-- `reopen_reason` null that comparison is null, and a check constraint accepts
-- null, so a row could be reopened with no reason. This replaces the
-- constraint with one that names the null case.

alter table atlas.wallet_task_checks
  drop constraint if exists wallet_task_checks_reopen_reason_check;

alter table atlas.wallet_task_checks
  add constraint wallet_task_checks_reopen_reason_check check (
    (reopened_at is null and reopen_reason is null)
    or (reopened_at is not null and reopen_reason is not null and length(btrim(reopen_reason)) > 0)
  );
