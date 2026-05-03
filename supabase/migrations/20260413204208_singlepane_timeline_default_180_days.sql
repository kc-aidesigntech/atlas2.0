do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'atlas'
      and table_name = 'app_config_documents'
  ) then
    update atlas.app_config_documents
    set payload = jsonb_set(
      jsonb_set(
        jsonb_set(
          payload,
          '{durationMonths}',
          '6'::jsonb,
          true
        ),
        '{maxDurationMonths}',
        '12'::jsonb,
        true
      ),
      '{gates}',
      '[
        { "id": "gate-regulation", "label": "regulation", "phase": "regulation", "monthOffset": 0 },
        { "id": "gate-readiness", "label": "readiness", "phase": "readiness", "monthOffset": 2 },
        { "id": "gate-renewal", "label": "renewal", "phase": "renewal", "monthOffset": 4 },
        { "id": "gate-plan-end", "label": "plan end", "phase": "renewal", "monthOffset": 6 }
      ]'::jsonb,
      true
    )
    where surface = 'singlepane'
      and config_key = 'timeline_defaults';
  end if;
end $$;;
