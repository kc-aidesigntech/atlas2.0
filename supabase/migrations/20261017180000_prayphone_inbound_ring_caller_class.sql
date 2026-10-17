-- The conferencer writes every inbound source onto the ring row.
-- The header accepts kiosk, anonymous, enrollee, and prospective.
-- Atlas enables only kiosk until a source is turned on.
-- The default keeps a row that is already ringing audible after this column exists.

alter table atlas.prayphone_inbound_rings
  add column if not exists caller_class text not null default 'kiosk';

alter table atlas.prayphone_inbound_rings
  drop constraint if exists prayphone_inbound_rings_caller_class_check;

alter table atlas.prayphone_inbound_rings
  add constraint prayphone_inbound_rings_caller_class_check
    check (caller_class in ('kiosk', 'anonymous', 'enrollee', 'prospective'));

comment on column atlas.prayphone_inbound_rings.caller_class is
  'Caller class for this ring. The header accepts kiosk, anonymous, enrollee, and prospective. Atlas enables only kiosk until a source is turned on.';
