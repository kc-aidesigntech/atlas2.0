# Power BI Semantic Model (County Commons + ATLAS-INTEL)

## Model scope

Use a single semantic model with perspective-specific reports:

- County Commons perspective: county-level throughput and capacity
- ATLAS-INTEL perspective: partner, navigator, supervisor, assessment performance

## Core tables

- Dimensions:
  - `dim_county` (`atlas.v_dw_dim_county`)
  - `dim_partner_station` (`atlas.v_dw_dim_partner_station`)
  - `dim_person_role_active` (`atlas.v_dw_dim_person_role_active`)
  - `dim_date` (Power BI generated date table)
- Facts:
  - `fact_enrollment_snapshot_daily` (`atlas.v_dw_fact_enrollment_snapshot`)
  - `fact_assignment_edges_daily` (`atlas.v_dw_fact_assignment_edges_daily`)
  - `fact_journey_events` (`atlas.v_dw_fact_journey_events`)
  - `fact_assessment_submissions` (`atlas.v_dw_fact_assessment_submissions`)
  - `fact_assessment_answers` (`atlas.v_dw_fact_assessment_answers`)
  - `fact_kpi_daily` (`atlas.v_dw_kpi_daily`)

## Required relationships

- `fact_enrollment_snapshot_daily.county_id` -> `dim_county.county_id` (many-to-one)
- `fact_assignment_edges_daily.enrollment_id` -> `fact_enrollment_snapshot_daily.enrollment_id` (many-to-one)
- `fact_assessment_submissions.enrollment_id` -> `fact_enrollment_snapshot_daily.enrollment_id` (many-to-one)
- `fact_assessment_answers.assessment_submission_id` -> `fact_assessment_submissions.assessment_submission_id` (many-to-one)
- Date role to all `*_date` / `submitted_at` fields where appropriate.

## KPI measure definitions (DAX)

```dax
Active Enrollees :=
DISTINCTCOUNT ( fact_enrollment_snapshot_daily[enrollment_id] )

Active Navigators :=
DISTINCTCOUNT ( fact_assignment_edges_daily[navigator_person_id] )

Enrollee Navigator Ratio :=
DIVIDE ( [Active Enrollees], [Active Navigators] )

Assessment Completion Rate :=
DIVIDE (
    CALCULATE ( COUNTROWS ( fact_assessment_submissions ), fact_assessment_submissions[status] = "completed" ),
    COUNTROWS ( fact_assessment_submissions )
)
```

## Row-level security design

Use `atlas.v_dw_rls_principal_scope` as the principal/scope map:

- `principal_email`: `USERPRINCIPALNAME()` match
- County reports filter: `fact_enrollment_snapshot_daily[county_id] in scope county ids`
- Partner reports filter: `fact_enrollment_snapshot_daily[partner_id] in scope partner ids`

Recommended Power BI roles:

- `CountyCommonsReader`: county-scope access only
- `AtlasIntelPartnerReader`: partner-scope access only
- `AtlasIntelOperationsReader`: supervisor/navigator/admin county scope

## Deployment checklist

1. Refresh dataset from warehouse contracts.
2. Validate KPI totals against SQL:
   - `select * from atlas.v_dw_kpi_daily order by snapshot_date desc, county_name;`
3. Validate RLS with test principals from each role.
4. Publish perspectives for County Commons and ATLAS-INTEL.
