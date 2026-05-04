-- Launch Row-Level Security (RLS) scope tightening:
-- - replace broad authenticated policies with person- and assignment-scoped access
-- - remove residual public profile-image metadata read access
-- - keep administrator bypass behavior for operational support workflows

create or replace function atlas.fn_can_access_enrollment_as_staff(target_enrollment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = atlas, public
as $$
  with current_person as (
    select atlas.fn_current_person_id() as person_id
  )
  select exists (
    select 1
    from current_person cp
    where cp.person_id is not null
      and (
        -- Navigator assignment scope.
        exists (
          select 1
          from atlas.navigator_assignments na
          where na.enrollment_id = target_enrollment_id
            and na.navigator_person_id = cp.person_id
            and na.ends_on is null
        )
        or
        -- Supervisor scope through active navigator edges.
        exists (
          select 1
          from atlas.navigator_assignments na
          join atlas.supervisor_navigator_assignments sna
            on sna.navigator_person_id = na.navigator_person_id
           and sna.ends_on is null
          where na.enrollment_id = target_enrollment_id
            and na.ends_on is null
            and sna.supervisor_person_id = cp.person_id
        )
      )
  );
$$;

revoke all on function atlas.fn_can_access_enrollment_as_staff(uuid) from public;
grant execute on function atlas.fn_can_access_enrollment_as_staff(uuid) to authenticated;

create or replace function atlas.fn_can_manage_enrollee_burden_submission(target_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = atlas, public
as $$
  select exists (
    select 1
    from atlas.enrollee_burden_survey_submissions s
    where s.id = target_submission_id
      and (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
        or s.respondent_person_id = atlas.fn_current_person_id()
        or atlas.fn_can_access_enrollment_as_staff(s.enrollment_id)
      )
  );
$$;

revoke all on function atlas.fn_can_manage_enrollee_burden_submission(uuid) from public;
grant execute on function atlas.fn_can_manage_enrollee_burden_submission(uuid) to authenticated;

drop policy if exists "enrollee burden survey submissions authenticated" on atlas.enrollee_burden_survey_submissions;
drop policy if exists "enrollee burden survey answers authenticated" on atlas.enrollee_burden_survey_answers;

create policy enrollee_burden_submissions_select_scoped
on atlas.enrollee_burden_survey_submissions
for select
to authenticated
using (
  coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
  or respondent_person_id = atlas.fn_current_person_id()
  or atlas.fn_can_access_enrollment_as_staff(enrollment_id)
);

create policy enrollee_burden_submissions_insert_scoped
on atlas.enrollee_burden_survey_submissions
for insert
to authenticated
with check (
  coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
  or (
    respondent_person_id = atlas.fn_current_person_id()
    and atlas.fn_can_access_enrollment_as_staff(enrollment_id)
  )
);

create policy enrollee_burden_submissions_update_scoped
on atlas.enrollee_burden_survey_submissions
for update
to authenticated
using (
  coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
  or respondent_person_id = atlas.fn_current_person_id()
)
with check (
  coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
  or (
    respondent_person_id = atlas.fn_current_person_id()
    and atlas.fn_can_access_enrollment_as_staff(enrollment_id)
  )
);

create policy enrollee_burden_submissions_delete_scoped
on atlas.enrollee_burden_survey_submissions
for delete
to authenticated
using (
  coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
  or respondent_person_id = atlas.fn_current_person_id()
);

create policy enrollee_burden_answers_select_scoped
on atlas.enrollee_burden_survey_answers
for select
to authenticated
using (atlas.fn_can_manage_enrollee_burden_submission(submission_id));

create policy enrollee_burden_answers_insert_scoped
on atlas.enrollee_burden_survey_answers
for insert
to authenticated
with check (atlas.fn_can_manage_enrollee_burden_submission(submission_id));

create policy enrollee_burden_answers_update_scoped
on atlas.enrollee_burden_survey_answers
for update
to authenticated
using (atlas.fn_can_manage_enrollee_burden_submission(submission_id))
with check (atlas.fn_can_manage_enrollee_burden_submission(submission_id));

create policy enrollee_burden_answers_delete_scoped
on atlas.enrollee_burden_survey_answers
for delete
to authenticated
using (atlas.fn_can_manage_enrollee_burden_submission(submission_id));

drop policy if exists profile_images_public_select on atlas.profile_images;
drop policy if exists profile_images_authenticated_select on atlas.profile_images;
drop policy if exists profile_images_authenticated_insert on atlas.profile_images;
drop policy if exists profile_images_authenticated_update on atlas.profile_images;
drop policy if exists profile_images_authenticated_delete on atlas.profile_images;

create policy profile_images_authenticated_select_scoped
on atlas.profile_images
for select
to authenticated
using (
  coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
  or exists (
    select 1
    from atlas.enrollees e
    where e.id = profile_images.enrollee_id
      and e.person_id = atlas.fn_current_person_id()
  )
  or exists (
    select 1
    from atlas.enrollments en
    where en.enrollee_id = profile_images.enrollee_id
      and atlas.fn_can_access_enrollment_as_staff(en.id)
  )
);

create policy profile_images_authenticated_insert_scoped
on atlas.profile_images
for insert
to authenticated
with check (
  storage_bucket = 'profile-images'
  and (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
    or exists (
      select 1
      from atlas.enrollments en
      where en.enrollee_id = profile_images.enrollee_id
        and atlas.fn_can_access_enrollment_as_staff(en.id)
    )
  )
);

create policy profile_images_authenticated_update_scoped
on atlas.profile_images
for update
to authenticated
using (
  coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
  or exists (
    select 1
    from atlas.enrollments en
    where en.enrollee_id = profile_images.enrollee_id
      and atlas.fn_can_access_enrollment_as_staff(en.id)
  )
)
with check (
  storage_bucket = 'profile-images'
  and (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
    or exists (
      select 1
      from atlas.enrollments en
      where en.enrollee_id = profile_images.enrollee_id
        and atlas.fn_can_access_enrollment_as_staff(en.id)
    )
  )
);

create policy profile_images_authenticated_delete_scoped
on atlas.profile_images
for delete
to authenticated
using (
  coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
  or exists (
    select 1
    from atlas.enrollments en
    where en.enrollee_id = profile_images.enrollee_id
      and atlas.fn_can_access_enrollment_as_staff(en.id)
  )
);

create or replace function atlas.fn_can_access_partner_scope(target_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = atlas, public
as $$
  with current_person as (
    select atlas.fn_current_person_id() as person_id
  )
  select
    coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
    or (
      target_partner_id is not null
      and exists (
        select 1
        from current_person cp
        where cp.person_id is not null
          and (
            exists (
              select 1
              from atlas.partner_contact_assignments pca
              where pca.partner_id = target_partner_id
                and pca.person_id = cp.person_id
                and pca.ends_on is null
            )
            or exists (
              select 1
              from atlas.partners part
              join atlas.people person on person.id = cp.person_id
              where part.id = target_partner_id
                and part.primary_contact_email is not null
                and person.email is not null
                and lower(part.primary_contact_email) = lower(person.email)
            )
          )
      )
    );
$$;

revoke all on function atlas.fn_can_access_partner_scope(uuid) from public;
grant execute on function atlas.fn_can_access_partner_scope(uuid) to authenticated;

drop policy if exists partner_service_capacity_submissions_select on atlas.partner_service_capacity_submissions;
drop policy if exists partner_service_capacity_submissions_insert on atlas.partner_service_capacity_submissions;
drop policy if exists partner_service_capacity_submissions_update on atlas.partner_service_capacity_submissions;
drop policy if exists partner_service_capacity_submissions_delete on atlas.partner_service_capacity_submissions;
drop policy if exists partner_service_capacity_answers_select on atlas.partner_service_capacity_answers;
drop policy if exists partner_service_capacity_answers_insert on atlas.partner_service_capacity_answers;
drop policy if exists partner_service_capacity_answers_update on atlas.partner_service_capacity_answers;
drop policy if exists partner_service_capacity_answers_delete on atlas.partner_service_capacity_answers;
drop policy if exists partner_z_code_burden_scores_select on atlas.partner_z_code_burden_scores;
drop policy if exists partner_z_code_burden_scores_insert on atlas.partner_z_code_burden_scores;
drop policy if exists partner_z_code_burden_scores_update on atlas.partner_z_code_burden_scores;
drop policy if exists partner_z_code_burden_scores_delete on atlas.partner_z_code_burden_scores;

create policy partner_service_capacity_submissions_select_scoped
on atlas.partner_service_capacity_submissions
for select
to authenticated
using (atlas.fn_can_access_partner_scope(partner_id));

create policy partner_service_capacity_submissions_insert_scoped
on atlas.partner_service_capacity_submissions
for insert
to authenticated
with check (atlas.fn_can_access_partner_scope(partner_id));

create policy partner_service_capacity_submissions_update_scoped
on atlas.partner_service_capacity_submissions
for update
to authenticated
using (atlas.fn_can_access_partner_scope(partner_id))
with check (atlas.fn_can_access_partner_scope(partner_id));

create policy partner_service_capacity_submissions_delete_scoped
on atlas.partner_service_capacity_submissions
for delete
to authenticated
using (atlas.fn_can_access_partner_scope(partner_id));

create policy partner_service_capacity_answers_select_scoped
on atlas.partner_service_capacity_answers
for select
to authenticated
using (
  exists (
    select 1
    from atlas.partner_service_capacity_submissions submission
    where submission.id = partner_service_capacity_answers.submission_id
      and atlas.fn_can_access_partner_scope(submission.partner_id)
  )
);

create policy partner_service_capacity_answers_insert_scoped
on atlas.partner_service_capacity_answers
for insert
to authenticated
with check (
  exists (
    select 1
    from atlas.partner_service_capacity_submissions submission
    where submission.id = partner_service_capacity_answers.submission_id
      and atlas.fn_can_access_partner_scope(submission.partner_id)
  )
);

create policy partner_service_capacity_answers_update_scoped
on atlas.partner_service_capacity_answers
for update
to authenticated
using (
  exists (
    select 1
    from atlas.partner_service_capacity_submissions submission
    where submission.id = partner_service_capacity_answers.submission_id
      and atlas.fn_can_access_partner_scope(submission.partner_id)
  )
)
with check (
  exists (
    select 1
    from atlas.partner_service_capacity_submissions submission
    where submission.id = partner_service_capacity_answers.submission_id
      and atlas.fn_can_access_partner_scope(submission.partner_id)
  )
);

create policy partner_service_capacity_answers_delete_scoped
on atlas.partner_service_capacity_answers
for delete
to authenticated
using (
  exists (
    select 1
    from atlas.partner_service_capacity_submissions submission
    where submission.id = partner_service_capacity_answers.submission_id
      and atlas.fn_can_access_partner_scope(submission.partner_id)
  )
);

create policy partner_z_code_burden_scores_select_scoped
on atlas.partner_z_code_burden_scores
for select
to authenticated
using (atlas.fn_can_access_partner_scope(partner_id));

create policy partner_z_code_burden_scores_insert_scoped
on atlas.partner_z_code_burden_scores
for insert
to authenticated
with check (atlas.fn_can_access_partner_scope(partner_id));

create policy partner_z_code_burden_scores_update_scoped
on atlas.partner_z_code_burden_scores
for update
to authenticated
using (atlas.fn_can_access_partner_scope(partner_id))
with check (atlas.fn_can_access_partner_scope(partner_id));

create policy partner_z_code_burden_scores_delete_scoped
on atlas.partner_z_code_burden_scores
for delete
to authenticated
using (atlas.fn_can_access_partner_scope(partner_id));

notify pgrst, 'reload schema';
