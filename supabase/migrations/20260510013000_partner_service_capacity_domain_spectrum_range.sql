alter table atlas.partner_service_capacity_answers
  drop constraint if exists partner_service_capacity_answers_burden_score_check;

alter table atlas.partner_service_capacity_answers
  add constraint partner_service_capacity_answers_burden_score_check
  check (
    (not_encountered = true and burden_score is null) or
    (not_encountered = false and burden_score between 1 and 99)
  );
