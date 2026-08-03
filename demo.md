# Demo Partner Station: Five Phenotype Enrollees

This document is the explicit plan-of-record for the demo partner station used in the "what comes back to them" demo beat. Every record described here is modeled verbatim by the seed migration `supabase/migrations/20260715180000_demo_partner_phenotype_seed.sql`, so each status shown in the partner "My Station" view can be traced field-by-field back to this file.

The demo shows an authentic partner profile whose station receives return signal from five phenotypical participants, each placed at a deliberately different stage of the journey:

| Case | Phenotype | Journey status modeled |
| --- | --- | --- |
| PHX-001 | SV — Stress-Vulnerable (DV Survivor) | Renewal reached (full arc, all Z-codes resolved) |
| PHX-002 | SP — Subthreshold Psychosis (Pre-Conversion) | Readiness, late (majority of burden resolved or partially resolved) |
| PHX-003 | SA — Spiritually Active (Spiritual Emergency → Emergence) | Regulation, stabilizing (one gate passed) |
| PHX-004 | YP-FEP — Young Person, First-Episode Psychosis (Post-Conversion) | Readiness, early (gates passed, route just begun) |
| PHX-005 | RR — Restorative Risk (DV Offender / Gang-Involved) | Regulation, entry (no gate passed yet) |

All five participants are fictional. All records carry the `atlas_demo` tag in `atlas.demo_record_tags` for scoping and clean teardown.

## Acronym Glossary

Expanded once here so the verbatim narratives below can use the short forms.

- Domestic Violence (DV)
- Stressful Life Event (SLE)
- Stress Vulnerability Scale (SVS)
- Mental Health Self-Care Agency (MH-SCA) scale
- Inventory of Psychosocial Functioning (IPF)
- Brief Inventory of Psychosocial Functioning (B-IPF)
- Psychosocial Rehabilitation (PSR)
- Coordinated Specialty Care (CSC)
- Level of Service / Case Management Inventory (LS/CMI)
- Crime Prevention Through Environmental Design (CPTED)
- Row-Level Security (RLS)
- Remote Procedure Call (RPC)

## Demo Partner Identity

| Field | Value |
| --- | --- |
| Organization | Harborview Family Advocacy Center |
| `atlas.partners.id` | `de300000-0000-0000-0000-0000000000a1` |
| `organization_name_normalized` | `harborview family advocacy center` |
| Primary contact | Harper Voss (`demo.partner@atlas.test`) |
| Contact person id (`atlas.people.id`) | `de300000-0000-0000-0000-0000000000c1` |
| Station (`atlas.partner_stations.id`) | `de300000-0000-0000-0000-0000000000a2` — "Harborview Main Station", capacity 12 total / 7 available |
| Demo navigator | Devon Marsh (`atlas.people.id` `de300000-0000-0000-0000-0000000000b1`), assigned to all five enrollments at the Harborview station |

### Login wiring

- The partner login is provisioned by `verification/demo_partner_setup.sql` (auth writes live in verification scripts, never migrations, following the `verification/pilot_setup.sql` pattern). Auth user id equals the contact person id; the identity-bridge trigger merges into the pre-seeded `atlas.people` row. Password matches the pilot convention: `AtlasPilot2026!`.
- `auth.users.raw_user_meta_data.organization_name` is set to `Harborview Family Advocacy Center` so the account-settings fallback resolves the correct organization, which is what `loadPartnerStationProfile` uses to look up `atlas.v_partner_station_directory` (verified present live).
- RLS visibility: `atlas.fn_can_access_enrollment_as_staff` only admits navigators assigned to an enrollment or supervisors of those navigators. So Harper Voss carries one `atlas.supervisor_navigator_assignments` edge over Devon Marsh. This is the documented mechanism (not a workaround) by which the partner login can read the five demo enrollments through the invoker views; the side effect is that Harper appears as Devon's overseer in supervisor rollups, which is acceptable for the demo and removed by teardown.
- Partner scoping in the app: the partner role scopes its strip to enrollments tagged `atlas_demo` in `atlas.demo_record_tags` (`record_type = 'enrollments'`), which is exactly how these five are tagged.

### Station capability profile

Harborview submits DV-focused service capacity: `atlas.partner_z_code_capabilities` (relation `specialize`, source `survey`) and `atlas.partner_z_code_burden_scores` are seeded for Z65.4 (9), Z59.0 (8), Z59.1 (8), Z63.0 (8), Z60.4 (7), Z59.6 (7), Z59.7 (7), Z56.0 (7), Z56.6 (6), Z55.2 (6), Z60.2 (6), Z60.0 (6). Strength is `burden_score / 9.0`. This makes the station rank as a real route candidate and gives the partner radial load real signal.

## Modeling Conventions

- **Journey phase** is persisted on `atlas.enrollees.current_phase` (`regulation` / `readiness` / `renewal`) and corroborated by route-log phases, so the partner strip and the enrollee profile agree.
- **Regulation gates** are persisted as completed `atlas.navigator_regulation_test_submissions` rows (types `mh_sca`, threshold 126, and `svs`, threshold 60) with three answer rows each matching the placeholder catalog prompts (`mhsca-1..3`, `svs-1..3`). Readiness visibility in the app is derived from the latest completed pair both having `passed = true`.
- **Z-code burden (radial load)** is persisted in `atlas.enrollee_z_codes` with the readiness criteria columns: `code_review_status` (`not_resolved` / `partially_resolved` / `resolved`), `confidence_level` (`low` / `medium` / `high`), and resolution attribution (`resolution_partner_id` / `resolution_partner_name` / `resolution_note`) pointing at Harborview when resolved. `is_resolved` is kept in lockstep with `code_review_status = 'resolved'`.
- **Route plans and station markers**: `atlas.route_plans` + `atlas.route_plan_stops` at the Harborview station. Completed stops surface through `atlas.v_enrollment_station_markers` as history markers.
- **Timeline entries** are written to both planes the app reads: canonical `atlas.journey_logs` rows, and the runtime route-log document (`atlas.app_config_documents`, surface `singlepane`, key `route_logs`, version `runtime-v1`). Runtime entries use deterministic ids prefixed `demo-phenotype-` so re-seeding replaces rather than duplicates them.
- **Route assignments** (the "active" dots on the partner strip) are runtime config documents `route_assignment:{enrolleeId}` referencing the Harborview station.
- **Timeline configuration** is seeded in `atlas.timeline_settings` (9-month plan, regulation cutoff month 3, readiness cutoff month 6) and mirrored to `timeline_config:enrollment:{id}` / `timeline_config:enrollee:{id}` config documents with the standard gate set (regulation at month 0, readiness at month 3, renewal at month 6).
- **Referral provenance** ("how they refer" → "what comes back"): each participant has one `atlas.public_referral_intake_events` row (source `public_landing`, event type `referral`, status `claimed`, referrer organization Harborview, claimed by Devon Marsh) and one canonical `atlas.referrals` row attributing the Harborview station.
- **Instruments without schema homes** — the Danger Assessment, IPF narrative results, LS/CMI dynamic risk factors, allostatic load observations, and the Pocket Guide — are recorded as dated timeline entries (journey logs / route logs). The regulation-test table only persists `mh_sca` and `svs` (live check constraint), so IPF improvement is evidenced in renewal-phase log labels, matching the narratives ("IPF marked improvement…").

Deterministic identifiers: every seeded row uses a fixed Universally Unique Identifier (UUID) in the `de300000-…` range (tabulated per phenotype below) and people use `external_ref` values `demo-phenotype-{sv|sp|sa|yp|rr}` so the seed is idempotent and traceable.

---

## 1. SV — Stress-Vulnerable (DV Survivor)

### Phenotype 1 Narrative — SV: Stress-Vulnerable (DV Survivor)

Following an escalation of intimate partner violence compounded by housing instability and financial strain, the participant entered stabilization through a short respite stay focused on immediate safety and nervous system regulation. Removal from the threat environment, restoration of sleep and daily rhythm, and DV-informed peer containment allowed stress vulnerability and self-care agency to stabilize under protected conditions. As regulation held, precision psychosocial rehabilitation targeted unburdening across life-production domains, including relocation to DV-informed housing, severing coercive relational ties, re-establishing voluntary social supports, and stabilizing work routines. Over time, measurable reductions in Z-code burden signaled alleviation of threat, housing insecurity, and social isolation. Renewal was evidenced by marked improvement in psychosocial functioning, reflected in restored independent living, sustained work participation, and safe relational engagement. The participant re-entered valued roles, contributed to survivor peer mentoring and community safety efforts, and demonstrated durable stabilization, with declining allostatic load confirming that protected regulation and unburdening were biologically holding.

**Triggering SLE:** Escalation of intimate partner violence following financial stress and housing instability.

**(strip map)**

*Regulation — Pillars of Stability.* Entry point: Respite visit / stay. SVS: elevated → stabilizing. MH-SCA: low–moderate → stabilizing. Danger Assessment: concerning. Immediate removal from the threat environment. Restoration of sleep, meals, predictability, and low sensory load. Peer containment and DV-informed staff presence. Pocket Guide completed once safety and regulation hold. System state: Regulation is achieved when SVS and MH-SCA stabilize under protected conditions, indicating the nervous system is no longer operating under sustained threat.

*Readiness — Life Production Domains.* Unburdening begins. Habitat: relocation support, DV-informed housing placement, CPTED-aligned safety modifications. Social Networks: severing coercive or unsafe ties, re-establishing non-threatening, voluntary supports. Work: schedule stabilization, graduated return to productivity. Proof of radial load alleviation: measurable reduction in Z-code burden related to victimization, housing instability, social isolation. System interpretation: Readiness is confirmed through observable unburdening across life-production domains, not through insight or symptom report.

*Renewal — Civic Yield.* Proof of reciprocity: marked improvement on the IPF, reflecting stable independent living, restored work participation, safe voluntary relational engagement. Returns to valued roles (employment and caregiving). Participates in survivor peer mentoring and mutual aid. Contributes to community safety dialogues and DV-prevention efforts. Indirect contribution to crime reduction through sustained absence of revictimization and strengthened collective safety. System interpretation: IPF improvement signals the transition from extraction and survival to reciprocal participation and civic integration.

*Honorable Mention (Confirmatory, Not Driving).* As safety and stabilization hold over time, allostatic load declines, confirming that protected regulation and sustained unburdening are biologically holding.

**z-burden (radial load):** Primary Social Risk Signal: Z65.4 – Victim of crime and terrorism (DV anchor). Habitat / Economic Stability: Z59.0 – Homelessness (if displacement occurred), Z59.1 – Inadequate housing, Z59.6 – Low income, Z59.7 – Insufficient social insurance and welfare support. Social Environment / Support: Z60.4 – Social exclusion and rejection, Z63.0 – Problems in relationship with spouse or partner, Z63.7 – Other stressful life events affecting family and household. Education / Work Impact: Z56.0 – Unemployment (if work disruption occurred), Z56.2 – Threat of job loss. Why these matter: these codes encode threat exposure, housing instability, and relational harm — the exact pressure sources PSR is designed to unburden.

### Modeled records — SV

| Field | Value |
| --- | --- |
| Person | Selena Vargas, `external_ref` `demo-phenotype-sv`, person id `de300000-0000-0000-0000-000000000011` |
| Enrollee | id `de300000-0000-0000-0000-000000000012`, case `PHX-001`, date of birth 1989-03-14, `current_phase = 'renewal'` |
| Enrollment | id `de300000-0000-0000-0000-000000000013`, start 2026-01-12, 9 months, active |
| Referral | queue record `demo-phenotype-sv-referral`, referred 2026-01-05, claimed by Devon Marsh 2026-01-12; background notes carry the triggering SLE verbatim |
| Regulation gates | MH-SCA completed 2026-02-09, score 132 / threshold 126, passed (submission `…0018`); SVS completed 2026-02-16, score 70 / threshold 60, passed (submission `…0019`) |
| Route plan | id `…0014`, status `completed`; stops all `completed` at Harborview Main Station: stop 1 Z59.1 (assigned 2026-03-09), stop 2 Z60.4 (assigned 2026-04-13), stop 3 Z56.0 (assigned 2026-05-11) |
| Route assignment doc | phase `renewal`, assigned 2026-05-11, matched codes Z59.1 / Z60.4 / Z56.0 |

Z-codes (all `resolved`, `is_resolved = true`, confidence `high`, resolution partner Harborview Family Advocacy Center):

| Z-code | Resolution date | Resolution note |
| --- | --- | --- |
| Z65.4 | 2026-06-08 | Sustained absence of revictimization; safety plan holding |
| Z59.0 | 2026-03-30 | Displacement ended at respite entry; no return to homelessness |
| Z59.1 | 2026-04-06 | Relocated to DV-informed housing with CPTED-aligned modifications |
| Z59.6 | 2026-05-25 | Income stabilized through sustained work participation |
| Z59.7 | 2026-05-25 | Benefits and social insurance supports secured |
| Z60.4 | 2026-05-04 | Voluntary, non-threatening supports re-established |
| Z63.0 | 2026-04-20 | Coercive relational ties severed with legal supports |
| Z63.7 | 2026-05-04 | Household stressors resolved with relocation |
| Z56.0 | 2026-06-01 | Graduated return to productivity completed |
| Z56.2 | 2026-06-01 | Work schedule stabilized; job threat removed |

Timeline entries (journey logs + runtime route logs, ids `demo-phenotype-sv-log-1..9`):

| # | Phase | Type | Status | Date | Label |
| --- | --- | --- | --- | --- | --- |
| 1 | regulation | intervention | completed | 2026-01-13 | respite stay — immediate removal from threat environment; Danger Assessment: concerning |
| 2 | regulation | verifiedMilestone | completed | 2026-01-27 | sleep, meals, and daily rhythm restored under DV-informed peer containment |
| 3 | regulation | verifiedMilestone | completed | 2026-02-16 | Pocket Guide completed — SVS and MH-SCA stabilized under protected conditions |
| 4 | readiness | intervention | completed | 2026-03-09 | relocation to DV-informed housing with CPTED-aligned safety modifications |
| 5 | readiness | intervention | completed | 2026-04-20 | coercive ties severed; voluntary social supports re-established |
| 6 | readiness | intervention | completed | 2026-05-11 | work schedule stabilized — graduated return to productivity |
| 7 | renewal | verifiedMilestone | completed | 2026-06-15 | IPF marked improvement — independent living, work participation, safe relational engagement |
| 8 | renewal | sustainedChange | completed | 2026-06-29 | survivor peer mentoring and community safety contribution begun |
| 9 | renewal | sustainedChange | completed | 2026-07-06 | allostatic load declining — protected regulation biologically holding |

Domains relieved: housing (logs 4), social (logs 5, 8), work (log 6).

---

## 2. SP — Subthreshold Psychosis (Pre-Conversion)

### Phenotype 2 Narrative — SP: Subthreshold Psychosis (Pre-Conversion)

Following a violent assault and subsequent academic disruption, the participant entered stabilization during a period of heightened stress sensitivity marked by attenuated perceptual disturbances without loss of insight. A brief respite stay emphasizing sleep restoration, sensory regulation, and non-interpretive containment allowed stress amplification to subside and self-care agency to stabilize without pathologizing experience. As regulation held, precision psychosocial rehabilitation focused on unburdening contextual stressors by re-establishing predictable living conditions, anchoring peer connections, and recalibrating academic load. Reduction in stress-linked Z-code burden and diminished environmental amplification of perceptual experiences signaled readiness. Renewal was evidenced by preserved academic enrollment, improved psychosocial functioning, and sustained peer engagement, preventing conversion and supporting continuity of developmental trajectory. Stabilization reduced downstream healthcare utilization risk, with physiologic measures confirming that regulated environments and unburdened routines were holding over time.

**Triggering SLE:** Violent assault followed by academic disruption during college.

**(strip map)**

*Regulation — Pillars of Stability.* Entry point: Short respite stay with monitoring. SVS: elevated → stabilizing. MH-SCA: moderate → stabilizing. Restoration of sleep and circadian rhythm. Sensory regulation and reduced cognitive load. No interpretation, reframing, or pathologizing of experiences. Pocket Guide completed once arousal and vigilance downshift. System state: Regulation is achieved when stress amplification subsides and the individual can maintain self-care and daily rhythm without escalation.

*Readiness — Life Production Domains.* Unburdening begins. Habitat: predictable and low-volatility living conditions. Social Networks: anchored peer connections, reduction of isolation without over-stimulation. Work / School: academic load recalibration, restored routine and expectations. Proof of radial load alleviation: measurable reduction in stress-linked Z-code burden; perceptual disturbances no longer amplified by environmental pressure. System interpretation: Readiness is confirmed when contextual stress no longer escalates attenuated experiences, reducing risk of conversion without suppressing subjectivity.

*Renewal — Civic Yield.* Proof of reciprocity: marked improvement on the IPF, reflecting sustained academic role functioning, peer engagement and relational continuity, balanced leisure and daily structure. Maintains student identity and enrollment. Participates in campus peer-support or mutual aid initiatives. Prevention of conversion contributes to reduced downstream healthcare utilization and improved institutional retention and continuity. System interpretation: IPF improvement reflects preserved developmental trajectory, not symptom absence.

*Honorable Mention (Confirmatory, Not Driving).* As stress amplification resolves and regulation holds, allostatic load stabilizes, confirming that environmental buffering and sustained unburdening are biologically holding.

**z-burden (radial load):** Primary Social Risk Signals: Z65.4 – Victim of crime and terrorism (violent assault), Z60.0 – Problems of adjustment to life-cycle transitions. Education Disruption: Z55.2 – Failed school examinations, Z55.8 – Other problems related to education and literacy, Z55.9 – Problems related to education and literacy, unspecified. Social Environment: Z60.2 – Problems related to living alone, Z60.4 – Social exclusion and rejection. Economic / Role Strain: Z56.6 – Other physical and mental strain related to work (academic workload stress). Why these matter: these codes map stress amplification pathways that elevate conversion risk without asserting disease.

### Modeled records — SP

| Field | Value |
| --- | --- |
| Person | Samuel Park, `external_ref` `demo-phenotype-sp`, person id `de300000-0000-0000-0000-000000000021` |
| Enrollee | id `de300000-0000-0000-0000-000000000022`, case `PHX-002`, date of birth 2004-09-02, `current_phase = 'readiness'` |
| Enrollment | id `de300000-0000-0000-0000-000000000023`, start 2026-03-02, 9 months, active |
| Referral | queue record `demo-phenotype-sp-referral`, referred 2026-02-23, claimed 2026-03-02 |
| Regulation gates | MH-SCA completed 2026-04-06, score 129 / 126, passed (`…0028`); SVS completed 2026-04-13, score 68 / 60, passed (`…0029`) |
| Route plan | id `…0024`, status `active`; stop 1 Z55.2 `completed` (assigned 2026-04-20), stop 2 Z60.2 `completed` (assigned 2026-05-04), stop 3 Z56.6 `active` (assigned 2026-06-01) — all at Harborview Main Station |
| Route assignment doc | phase `readiness`, assigned 2026-06-01, matched codes Z55.2 / Z60.2 / Z56.6 |

Z-codes (readiness late — majority resolved or partially resolved):

| Z-code | Review status | Confidence | Resolution (partner = Harborview) |
| --- | --- | --- | --- |
| Z55.2 | resolved | high | 2026-05-18 — examinations retaken after academic load recalibration |
| Z60.2 | resolved | medium | 2026-06-08 — predictable low-volatility living conditions established |
| Z65.4 | partially_resolved | medium | — |
| Z60.0 | partially_resolved | medium | — |
| Z55.8 | partially_resolved | medium | — |
| Z60.4 | partially_resolved | low | — |
| Z55.9 | not_resolved | high | — |
| Z56.6 | not_resolved | medium | — |

Timeline entries (ids `demo-phenotype-sp-log-1..6`):

| # | Phase | Type | Status | Date | Label |
| --- | --- | --- | --- | --- | --- |
| 1 | regulation | intervention | completed | 2026-03-03 | short respite stay with monitoring — sleep and circadian restoration |
| 2 | regulation | intervention | completed | 2026-03-16 | sensory regulation and reduced cognitive load — no pathologizing of experience |
| 3 | regulation | verifiedMilestone | completed | 2026-04-13 | Pocket Guide completed — arousal and vigilance downshifted |
| 4 | readiness | intervention | completed | 2026-04-20 | academic load recalibrated; routine and expectations restored |
| 5 | readiness | intervention | completed | 2026-05-04 | anchored peer connections — isolation reduced without over-stimulation |
| 6 | readiness | verifiedMilestone | completed | 2026-06-08 | predictable living conditions confirmed — perceptual experiences no longer environmentally amplified |

Domains relieved: education (log 4), social (log 5), housing (log 6).

---

## 3. SA — Spiritually Active (Spiritual Emergency → Emergence)

### Phenotype 3 Narrative — SA: Spiritually Active (Spiritual Emergency → Emergence)

After a moral rupture followed by intensive contemplative practice without adequate integration support, the participant experienced destabilization driven by uncontained meaning rather than psychopathology. Stabilization began with respite-based grounding focused on restoring sleep, nutrition, daily rhythm, and relational containment without theological interpretation or suppression of experience. As regulation stabilized, precision psychosocial rehabilitation supported unburdening across life-production domains by reintroducing routine, connecting the participant with culturally congruent spiritual mentorship, and re-engaging daily responsibilities. Decreased Z-code burden related to existential distress and social dislocation reflected readiness. Renewal emerged as the participant integrated meaning into reciprocal social roles, demonstrated marked improvement in psychosocial functioning, and contributed to faith-community wellbeing and interfaith educational efforts. Physiologic regulation stabilized as meaning became structurally held within routine and relationship, confirming successful integration rather than suppression.

**Triggering SLE:** Moral rupture followed by intensive contemplative practice without adequate integration or communal grounding.

**(strip map)**

*Regulation — Pillars of Stability.* Entry point: Respite-based grounding. SVS: elevated → stabilizing. MH-SCA: moderate → stabilizing. Restoration of sleep, nutrition, and circadian rhythm. Relational containment without theological interpretation. Reduction of sensory and cognitive overload. Pocket Guide completed with emphasis on grounding and continuity, not suppression or reinterpretation. System state: Regulation is achieved when arousal and fragmentation subside, allowing experience to be held without escalation or loss of functional coherence.

*Readiness — Life Production Domains.* Unburdening begins. Habitat: routine and circadian restoration, predictable daily rhythm. Social Networks: culturally congruent spiritual mentorship, non-extractive, non-institutional support. Work: re-engagement with daily structure and responsibility. Proof of radial load alleviation: measurable reduction in Z-code burden related to existential distress and social dislocation; emotional intensity no longer destabilizes daily functioning. System interpretation: Readiness is confirmed when meaning-rich experiences no longer overwhelm life-production domains, allowing agency to be exercised without fragmentation.

*Renewal — Civic Yield.* Proof of reciprocity: marked improvement on the IPF, reflecting stable daily routine, relational engagement, participation in purposeful work or service. Integrates experience into service-oriented or teaching roles. Contributes to faith-community wellbeing and mutual support. Participates in interfaith or cultural education efforts. Enhances social cohesion, functioning as a protective civic asset rather than a destabilizing influence. System interpretation: IPF improvement signals successful integration of meaning into reciprocal social life, transforming inward intensity into outward contribution.

*Honorable Mention (Confirmatory, Not Driving).* As meaning becomes structurally held within routine and relationship, physiological regulation stabilizes, confirming that integration—not suppression—supports biological coherence.

**z-burden (radial load):** Primary Social Risk Signals: Z65.8 – Other specified problems related to psychosocial circumstances (spiritual emergency / existential rupture). Social Environment: Z60.0 – Problems of adjustment to life-cycle transitions, Z60.3 – Acculturation difficulty (esp. non-normative spiritual frameworks), Z60.4 – Social exclusion and rejection. Support Group Disruption: Z63.7 – Other stressful life events affecting family and household. Work / Role Disruption: Z56.6 – Other physical and mental strain related to work. Why these matter: these codes allow non-pathologizing capture of meaning-related destabilization while keeping the case squarely in PSR territory.

### Modeled records — SA

| Field | Value |
| --- | --- |
| Person | Sofia Amari, `external_ref` `demo-phenotype-sa`, person id `de300000-0000-0000-0000-000000000031` |
| Enrollee | id `de300000-0000-0000-0000-000000000032`, case `PHX-003`, date of birth 1996-11-27, `current_phase = 'regulation'` |
| Enrollment | id `de300000-0000-0000-0000-000000000033`, start 2026-06-08, 9 months, active |
| Referral | queue record `demo-phenotype-sa-referral`, referred 2026-06-01, claimed 2026-06-08 |
| Regulation gates | SVS completed 2026-06-29, score 66 / 60, passed (`…0039`); MH-SCA completed 2026-06-29, score 112 / 126, **not passed** (`…0038`) — moderate → stabilizing, so readiness is not yet open |
| Route plan | none yet (regulation phase; deliberate) |
| Route assignment doc | none |

Z-codes (all active, none resolved):

| Z-code | Review status | Confidence |
| --- | --- | --- |
| Z65.8 | not_resolved | high |
| Z60.0 | not_resolved | medium |
| Z60.3 | not_resolved | medium |
| Z60.4 | not_resolved | medium |
| Z63.7 | not_resolved | low |
| Z56.6 | not_resolved | low |

Timeline entries (ids `demo-phenotype-sa-log-1..3`):

| # | Phase | Type | Status | Date | Label |
| --- | --- | --- | --- | --- | --- |
| 1 | regulation | intervention | completed | 2026-06-10 | respite-based grounding — sleep, nutrition, and circadian rhythm restoration |
| 2 | regulation | intervention | completed | 2026-06-17 | relational containment without theological interpretation or suppression |
| 3 | regulation | intervention | active | 2026-07-08 | Pocket Guide in progress — grounding and continuity emphasis; MH-SCA re-check scheduled |

---

## 4. YP-FEP — Young Person, First-Episode Psychosis (Post-Conversion)

### Phenotype 4 Narrative — YP-FEP: Young Person, First-Episode Psychosis (Post-Conversion)

Following academic failure and social isolation during a critical developmental period, the participant experienced a first episode of psychosis that disrupted identity formation and role continuity. Stabilization was achieved through a structured stay combining medication optimization with restoration of daily rhythm, relational safety, and predictable interpersonal contact. Once arousal and fragmentation were sufficiently contained to allow engagement, precision psychosocial rehabilitation focused on unburdening developmental stressors by providing supported living, rebuilding low-demand social connections, and reintroducing education or employment aligned with cognitive and motivational capacity. Reduction in Z-code burden related to isolation and educational disruption confirmed readiness. Renewal was marked by significant improvement in psychosocial functioning, re-establishment of student or worker identity, and participation in peer-led CSC activities, reducing long-term disability risk. Declining allostatic load confirmed that developmental re-integration and sustained role functioning were biologically holding.

**Triggering SLE:** Academic failure combined with social isolation preceding a first psychotic episode during a critical developmental window.

**(strip map)**

*Regulation — Pillars of Stability.* Entry point: Stabilization stay with medication optimization. SVS: elevated → stabilizing. MH-SCA: low → stabilizing. Restoration of daily rhythm and sleep–wake cycle. Relational safety and predictable interpersonal contact. Symptom containment sufficient to restore continuity and engagement. Pocket Guide completed after stabilization holds, not during acute crisis. System state: Regulation is achieved when biological arousal, cognitive fragmentation, and environmental volatility are sufficiently contained to allow sustained engagement in daily life.

*Readiness — Life Production Domains.* Unburdening begins. Habitat: supported living with predictable structure. Social Networks: rebuilding trust and belonging through low-demand, consistent relationships. Work / Education: supported education or employment aligned with cognitive and motivational capacity. Proof of radial load alleviation: measurable reduction in Z-code burden related to social isolation, educational disruption, financial and developmental instability. System interpretation: Readiness is confirmed when stress no longer perpetuates withdrawal or disengagement, allowing functional capacity to re-emerge without escalation.

*Renewal — Civic Yield.* Proof of reciprocity: marked improvement on the IPF, reflecting restored student or worker role functioning, improved social participation, increased independence in daily living. Re-establishes age-appropriate identity as a student or worker. Participates in peer-led CSC or recovery-oriented activities. Reduces long-term disability risk by restoring valued roles early. Contributes to workforce and educational retention, reducing downstream institutional dependence. System interpretation: IPF improvement signals repair of disrupted developmental trajectory, not mere symptom stabilization.

*Honorable Mention (Confirmatory, Not Driving).* As role functioning and social participation stabilize, allostatic load declines, confirming that sustained unburdening and developmental re-integration are biologically holding.

**z-burden (radial load):** Primary Social Risk Signals: Z60.0 – Problems of adjustment to life-cycle transitions (developmental disruption). Education Disruption: Z55.1 – Schooling unavailable and unattainable, Z55.2 – Failed school examinations, Z55.9 – Problems related to education and literacy, unspecified. Social Isolation: Z60.2 – Problems related to living alone, Z60.4 – Social exclusion and rejection. Economic / Functional Impact: Z56.0 – Unemployment, Z56.6 – Other physical and mental strain related to work. Housing: Z59.1 – Inadequate housing (supported living context). Why these matter: these codes encode trajectory rupture, not diagnosis — aligning with CSC and renewal-focused PSR.

### Modeled records — YP-FEP

| Field | Value |
| --- | --- |
| Person | Yusuf Peters, `external_ref` `demo-phenotype-yp`, person id `de300000-0000-0000-0000-000000000041` |
| Enrollee | id `de300000-0000-0000-0000-000000000042`, case `PHX-004`, date of birth 2002-05-19, `current_phase = 'readiness'` |
| Enrollment | id `de300000-0000-0000-0000-000000000043`, start 2026-05-04, 9 months, active |
| Referral | queue record `demo-phenotype-yp-referral`, referred 2026-04-27, claimed 2026-05-04 |
| Regulation gates | MH-SCA completed 2026-06-08, score 127 / 126, passed (`…0048`); SVS completed 2026-06-15, score 63 / 60, passed (`…0049`) — readiness newly opened |
| Route plan | id `…0044`, status `active`; stop 1 Z59.1 `completed` (assigned 2026-06-22), stop 2 Z55.1 `active` (assigned 2026-06-29), stop 3 Z56.0 `planned` (assigned 2026-07-06) — all at Harborview Main Station |
| Route assignment doc | phase `readiness`, assigned 2026-06-22, matched codes Z59.1 / Z55.1 / Z56.0 |

Z-codes (readiness early — unburdening just begun):

| Z-code | Review status | Confidence | Resolution (partner = Harborview) |
| --- | --- | --- | --- |
| Z59.1 | partially_resolved | medium | — (supported living placement underway) |
| Z60.2 | partially_resolved | medium | — |
| Z60.0 | not_resolved | high | — |
| Z55.1 | not_resolved | high | — |
| Z55.2 | not_resolved | medium | — |
| Z55.9 | not_resolved | medium | — |
| Z60.4 | not_resolved | medium | — |
| Z56.0 | not_resolved | medium | — |
| Z56.6 | not_resolved | low | — |

Timeline entries (ids `demo-phenotype-yp-log-1..5`):

| # | Phase | Type | Status | Date | Label |
| --- | --- | --- | --- | --- | --- |
| 1 | regulation | intervention | completed | 2026-05-05 | stabilization stay with medication optimization |
| 2 | regulation | verifiedMilestone | completed | 2026-05-25 | daily rhythm and sleep–wake cycle restored; predictable interpersonal contact |
| 3 | regulation | verifiedMilestone | completed | 2026-06-15 | Pocket Guide completed after stabilization held (not during acute crisis) |
| 4 | readiness | intervention | completed | 2026-06-22 | supported living placement with predictable structure |
| 5 | readiness | intervention | active | 2026-07-06 | supported education re-entry aligned with cognitive and motivational capacity |

Domains relieved: housing (log 4), education (log 5).

---

## 5. RR — Restorative Risk (DV Offender / Gang-Involved)

### Phenotype 5 Narrative — RR: Restorative Risk (DV Offender / Gang-Involved)

Following an untreated manic episode compounded by structural stress and criminogenic exposure, the participant was involved in a violent incident resulting in court-mandated stabilization. Initial regulation focused on medication adherence, enforced housing separation, removal from criminogenic peers, and establishment of predictable structure alongside clear accountability and safety planning. As impulsivity and environmental triggers were contained, precision psychosocial rehabilitation targeted unburdening across life-production domains through supervised housing, replacement of antisocial networks with pro-social mentors, and structured workforce engagement. Declines in criminogenic Z-code burden and dynamic risk factors confirmed readiness. Renewal was demonstrated by marked improvement in psychosocial functioning, sustained work participation, adherence to community norms, and supervised engagement in restorative justice and violence-interruption roles. Physiologic stabilization accompanied moral repair and governed behavior, supporting durable reductions in risk and measurable gains in community safety and civic trust.

**Triggering SLE:** Untreated manic episode combined with structural stress and criminogenic exposure, resulting in a violent incident.

**(strip map)**

*Regulation — Pillars of Stability.* Entry point: Court-mandated stabilization with enforced housing separation. SVS: high → stabilizing. MH-SCA: low → stabilizing. Medication initiation and adherence monitoring. Physical separation from victim and criminogenic peers. Predictable routine and supervised environment. Pocket Guide completed alongside accountability and safety planning. System state: Regulation is achieved when impulsivity, affective volatility, and environmental triggers are sufficiently contained to prevent recurrence and enable responsibility-bearing participation.

*Readiness — Life Production Domains.* Unburdening begins. Habitat: stable, supervised housing with enforced boundaries. Social Networks: replacement of antisocial peer exposure with mentors and pro-social accountability figures. Work: workforce training and structured daily responsibility. Proof of radial load alleviation: measurable decline in criminogenic Z-code burden; reduction in dynamic LS/CMI risk factors (peer association, impulsivity, instability). System interpretation: Readiness is confirmed when risk is actively governed, not merely suppressed, and the individual can sustain structure without escalation.

*Renewal — Civic Yield.* Proof of reciprocity: marked improvement on the IPF, reflecting sustained work participation, pro-social role engagement, adherence to boundaries and community norms. Participates in restorative justice processes (with survivor consent). Serves in supervised violence-interruption or de-escalation roles. Contributes directly to crime reduction in target zones. Advances community safety and civic trust through visible accountability. System interpretation: IPF improvement signals moral repair expressed through function, not erasure of risk or harm.

*Honorable Mention (Confirmatory, Not Driving).* As accountability, structure, and role-based contribution hold over time, physiological regulation stabilizes, confirming that governed behavior and moral repair are biologically holding.

**z-burden (radial load):** Primary Social Risk Signals: Z65.0 – Conviction in civil and criminal proceedings without imprisonment, Z65.1 – Imprisonment and other incarceration (if applicable). Social Environment / Criminogenic Exposure: Z60.4 – Social exclusion and rejection, Z63.0 – Problems in relationship with spouse or partner. Upbringing / Developmental Risk (if present): Z62.810 – Personal history of physical and sexual abuse in childhood, Z62.811 – Personal history of psychological abuse in childhood, Z62.812 – Personal history of neglect in childhood. Economic / Work Instability: Z56.0 – Unemployment, Z56.6 – Other physical and mental strain related to work. Housing / Structural Stress: Z59.1 – Inadequate housing, Z59.7 – Insufficient social insurance and welfare support. Why these matter: these codes allow risk to remain visible while still supporting a restorative, accountability-centered PSR pathway.

### Modeled records — RR

| Field | Value |
| --- | --- |
| Person | Ray Rivera, `external_ref` `demo-phenotype-rr`, person id `de300000-0000-0000-0000-000000000051` |
| Enrollee | id `de300000-0000-0000-0000-000000000052`, case `PHX-005`, date of birth 1993-07-08, `current_phase = 'regulation'` |
| Enrollment | id `de300000-0000-0000-0000-000000000053`, start 2026-06-29, 9 months, active |
| Referral | queue record `demo-phenotype-rr-referral`, referred 2026-06-22 (court-mandated context in background notes), claimed 2026-06-29 |
| Regulation gates | MH-SCA completed 2026-07-06, score 96 / 126, **not passed** (`…0058`); SVS completed 2026-07-06, score 42 / 60, **not passed** (`…0059`) — entry state, both gates open |
| Route plan | none yet (deliberate — regulation entry) |
| Route assignment doc | none |

Z-codes (all active, none resolved — full criminogenic radial load visible):

| Z-code | Review status | Confidence |
| --- | --- | --- |
| Z65.0 | not_resolved | high |
| Z65.1 | not_resolved | medium |
| Z60.4 | not_resolved | medium |
| Z63.0 | not_resolved | high |
| Z62.810 | not_resolved | medium |
| Z62.811 | not_resolved | medium |
| Z62.812 | not_resolved | low |
| Z56.0 | not_resolved | high |
| Z56.6 | not_resolved | medium |
| Z59.1 | not_resolved | high |
| Z59.7 | not_resolved | medium |

Timeline entries (ids `demo-phenotype-rr-log-1..3`):

| # | Phase | Type | Status | Date | Label |
| --- | --- | --- | --- | --- | --- |
| 1 | regulation | intervention | completed | 2026-06-30 | court-mandated stabilization — enforced housing separation from victim and criminogenic peers |
| 2 | regulation | intervention | active | 2026-07-07 | medication initiation and adherence monitoring |
| 3 | regulation | intervention | active | 2026-07-10 | accountability and safety planning opened alongside Pocket Guide; LS/CMI dynamic risk factors baselined |

---

## Station Return Signal Summary

What the Harborview partner login sees on "My Station" once seeded:

- **Referred dots** for all five participants (one dot per active Z-code detail), each at its phenotype's phase.
- **Active dots** for SV, SP, and YP-FEP (the three with route assignments to the Harborview station).
- **Success history**: one record — SV reached renewal (the return signal proving the loop closes).
- **Station markers**: completed Harborview stops for SV (3), SP (2), and YP-FEP (1) via `atlas.v_enrollment_station_markers`.
- **Radial load**: partner capability network signal from the seeded Harborview specialization rows; enrollee radial loads from the per-phenotype Z-code sets above.
- One `atlas.station_metric_snapshots` row (5 active enrollments, 12 Z-codes resolved) backing the station metrics view.

## Provisioning Order

1. Apply migration `20260715180000_demo_partner_phenotype_seed.sql` (all `atlas` schema records; no auth writes).
2. Run `verification/demo_partner_setup.sql` (creates the `demo.partner@atlas.test` auth login and identities; idempotent).
3. Run `verification/demo_phenotypes_verify.sql` and confirm every assertion row reports `pass`.
4. Manual walkthrough: sign in as `demo.partner@atlas.test` / `AtlasPilot2026!` → "My Station" → confirm the five participants render at the stage spread above; open the strip history overlay and confirm the SV renewal success record.

## Applied State and Walkthrough Log

Recorded 2026-07-15 against the live Supabase project:

1. **Migration applied** — `demo_partner_phenotype_seed` is in the live migration history (statement-identical to `supabase/migrations/20260715180000_demo_partner_phenotype_seed.sql`).
2. **Auth login provisioned** — `verification/demo_partner_setup.sql` ran clean: `demo.partner@atlas.test` exists with `atlas_role = 'partner'`, is bridged to the Harper Voss person record, holds an active partner role, and supervises 1 navigator (Devon Marsh) — the Row-Level Security (RLS) read path for the five enrollments.
3. **Verification suite green** — `verification/demo_phenotypes_verify.sql` returned **36 / 36 `pass`**, covering: the partner/station directory row resolving in `atlas.v_partner_station_directory` (so "My Station" gets real data, not the generated fallback), all five phase placements, all gate states, per-phenotype Z-code status counts, SV's 3 completed station markers, route plan/stop states, journey-log counts, the 26 runtime route-log entries, referral attribution (5 claimed intake events + 5 canonical referrals), and the 19 `atlas_demo` teardown tags.
4. **Human walkthrough** — sign in as `demo.partner@atlas.test` / `AtlasPilot2026!` → "My Station". Expected per the data above: Selena Vargas at renewal with full resolved history, Samuel Park late-readiness, Sofia Amari stabilizing in regulation, Yusuf Peters early-readiness, Ray Rivera at regulation entry; strip history overlay shows SV's success record.

## Teardown

Every seeded row is tagged `atlas_demo` in `atlas.demo_record_tags` (record types: `people`, `enrollees`, `enrollments`, `partners`, `partner_stations`). Deleting the five people, the demo navigator, the Harborview partner (cascades stations, capabilities, stops via foreign keys), the `demo-phenotype-%` config-document entries, and the demo auth user removes the entire fixture. The seed migration's clean-up preamble is scoped to these fixed identifiers only.
