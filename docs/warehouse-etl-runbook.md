# Warehouse ETL Runbook

## Export contracts

Use only canonical warehouse contracts for extraction:

- `atlas.v_dw_dim_county`
- `atlas.v_dw_dim_partner_station`
- `atlas.v_dw_dim_person_role_active`
- `atlas.v_dw_fact_enrollment_snapshot`
- `atlas.v_dw_fact_assignment_edges_daily`
- `atlas.v_dw_fact_journey_events`
- `atlas.v_dw_fact_assessment_submissions`
- `atlas.v_dw_fact_assessment_answers`

## Incremental load pattern

1. Read watermark:

```sql
select last_success_at, last_cursor
from atlas.dw_export_watermarks
where pipeline_name = 'county_commons_daily';
```

2. Export changed slices using timestamp cursor from source views/tables.

3. Upsert into warehouse tables by business key.

4. Commit watermark:

```sql
select atlas.fn_dw_mark_pipeline_success(
  p_pipeline_name := 'county_commons_daily',
  p_last_cursor := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  p_metadata := jsonb_build_object('batchId', gen_random_uuid()::text, 'status', 'ok')
);
```

## Data-quality checks

Run parity checks after each load:

```sql
select * from atlas.v_assessment_submission_parity order by assessment_type;
select * from atlas.v_assessment_answer_parity order by assessment_type;
```
