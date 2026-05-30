-- Security hardening Phase 3 (reference flow, lock step): now that the frontend
-- writes the enrollee burden survey exclusively through the validated command
-- RPC (fn_save_enrollee_burden_submission / fn_delete_enrollee_burden_draft),
-- revoke direct write privileges from the authenticated role. The SECURITY
-- DEFINER RPCs continue to write as the table owner. SELECT is retained so the
-- existing scoped read policies keep serving the survey history UI.
revoke insert, update, delete on atlas.enrollee_burden_survey_submissions from authenticated;
revoke insert, update, delete on atlas.enrollee_burden_survey_answers from authenticated;
