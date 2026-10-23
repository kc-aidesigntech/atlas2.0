-- The Pi kiosk is caller class kiosk. A row left disabled keeps the
-- Atlas header quiet for that class while the phone app still rings.
-- Turn the kiosk source back on. The other three sources stay as they are.

update atlas.prayphone_ring_sources
set enabled = true
where source = 'kiosk';
