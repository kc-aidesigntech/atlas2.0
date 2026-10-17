-- Inbound caller class for the four agent-console queues.
-- The class is decided from the device that requested the call.
-- A model other than mobile is a kiosk. A phone stays anonymous,
-- enrollee, or prospective even when calls_as_device_id points at a
-- kiosk. Nullable so sessions written before this column existed still load.

alter table atlas.prayphone_call_sessions
  add column if not exists caller_class text,
  add column if not exists caller_label text;

comment on column atlas.prayphone_call_sessions.caller_class is
  'Inbound queue class: kiosk, anonymous, enrollee, or prospective. Null on sessions created before this column existed.';

comment on column atlas.prayphone_call_sessions.caller_label is
  'Text shown on the agent queue button. Device name for a kiosk, display name or email for a signed-in person, anonymous when there is no login.';
