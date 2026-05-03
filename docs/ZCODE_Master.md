# Z-Code Master

This document is the working source of truth for the Atlas (ATLAS) partner service-capacity Z-code survey taxonomy.

## Revision Notes

- `*` means revision to an existing entry.
- "Include" means the code should be added to the active survey taxonomy.
- "Delete" means the duplicate or redundant entry should be removed from the active survey taxonomy.
- `not encountered` is a valid survey outcome for conditionally relevant prompts and should persist as a null score in the database for that submission entry.

## Active Survey Taxonomy

### `Z55` Problems related to education and literacy *


| Code    | Title                                                              | Notes                                                                                       |
| ------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `Z55.0` | Illiteracy and low-level literacy                                  | Keep.                                                                                       |
| `Z55.1` | Schooling unavailable and unattainable                             | Keep.                                                                                       |
| `Z55.2` | Failed school examinations                                         | Keep.                                                                                       |
| `Z55.3` | Underachievement in school                                         | Keep.                                                                                       |
| `Z55.4` | Educational maladjustment and discord w/ teachers and classmates * | Fix spacing in `w/ teachers`.                                                               |
| `Z55.5` | Less than a high school diploma                                    | Keep.                                                                                       |
| `Z55.6` | Problems related to health literacy                                | Add. Example: difficulty understanding medication instructions or completing medical forms. |
| `Z55.8` | Other specified problems related to education and literacy *       | Replace duplicate "other problems" wording. Example: difficulty due to inadequate teaching. |
| `Z55.9` | Problems related to education and literacy, unspecified            | Keep once.                                                                                  |


Delete:

- `Z55.9`* Academic or educational problems

### `Z56` Problems related to employment and unemployment *


| Code     | Title                                            | Notes                                                                             |
| -------- | ------------------------------------------------ | --------------------------------------------------------------------------------- |
| `Z56.0`  | Unemployment, unspecified                        | Keep.                                                                             |
| `Z56.1`  | Change of job                                    | Keep.                                                                             |
| `Z56.2`  | Threat of job loss                               | Keep.                                                                             |
| `Z56.3`  | Stressful work schedule                          | Keep.                                                                             |
| `Z56.4`  | Discord with boss and workmates                  | Keep.                                                                             |
| `Z56.5`  | Uncongenial work environment                     | Keep.                                                                             |
| `Z56.6`  | Other physical and mental strain related to work | Keep.                                                                             |
| `Z56.81` | Sexual harassment on the job                     | Keep.                                                                             |
| `Z56.82` | Military deployment status                       | Add.                                                                              |
| `Z56.89` | Other specified problems related to employment * | Replace duplicate "other problems" wording. Example: furloughed or underemployed. |
| `Z56.9`  | Problems related to employment, unspecified      | Keep.                                                                             |


### `Z57` Occupational exposure to risk factors *

These prompts may be conditionally relevant. The survey should support `I encounter this` and `not encountered in our work`.


| Code     | Title                                                     | Notes                       |
| -------- | --------------------------------------------------------- | --------------------------- |
| `Z57.0`  | Occupational exposure to noise                            | Add.                        |
| `Z57.1`  | Occupational exposure to radiation                        | Add.                        |
| `Z57.2`  | Occupational exposure to dust                             | Add.                        |
| `Z57.3`  | Occupational exposure to other air contaminants           | Keep as broad parent.       |
| `Z57.31` | Occupational exposure to environmental tobacco smoke      | Add.                        |
| `Z57.39` | Occupational exposure to other air contaminants           | Add. Example: polluted air. |
| `Z57.4`  | Occupational exposure to toxic agents in agriculture      | Add.                        |
| `Z57.5`  | Occupational exposure to toxic agents in other industries | Add.                        |
| `Z57.6`  | Occupational exposure to extreme temperature              | Add.                        |
| `Z57.7`  | Occupational exposure to vibration                        | Add.                        |
| `Z57.8`  | Occupational exposure to other risk factors               | Keep.                       |
| `Z57.9`  | Occupational exposure to unspecified risk factor          | Keep.                       |


### `Z58` Problems related to physical environment

`Z58` should map to the habitat / physical-environment family and can use the alternate green service-line treatment.


| Code     | Title                                              | Notes |
| -------- | -------------------------------------------------- | ----- |
| `Z58.6`  | Inadequate drinking-water supply                   | Add.  |
| `Z58.81` | Basic services unavailable in physical environment | Add.  |


### `Z59` Problems related to housing and economic circumstances *

`Z59.00` should be removed from the active survey. `Z59.01` and `Z59.02` should appear conditionally only after `Z59.0` receives a scored response.


| Code     | Title                                                                    | Notes                                                                                   |
| -------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `Z59.0`  | Homelessness                                                             | Keep.                                                                                   |
| `Z59.01` | Sheltered homelessness                                                   | Keep as conditional follow-up to `Z59.0`.                                               |
| `Z59.02` | Unsheltered homelessness                                                 | Keep as conditional follow-up to `Z59.0`.                                               |
| `Z59.1`  | Inadequate housing                                                       | Keep.                                                                                   |
| `Z59.2`  | Discord with neighbors, lodgers, or landlord *                           | Revise wording.                                                                         |
| `Z59.3`  | Problem related to living in a residential institution                   | Keep.                                                                                   |
| `Z59.4`  | Lack of adequate food or safe drinking water                             | Keep.                                                                                   |
| `Z59.5`  | Extreme poverty                                                          | Keep.                                                                                   |
| `Z59.6`  | Low income                                                               | Keep.                                                                                   |
| `Z59.7`  | Insufficient social insurance or welfare support                         | Keep.                                                                                   |
| `Z59.8`  | Other specified problems related to housing and economic circumstances * | Example: risk of homelessness, housing instability, homeless within the past 12 months. |
| `Z59.82` | Transportation insecurity                                                | Add.                                                                                    |
| `Z59.86` | Financial insecurity                                                     | Add. Note: despite income level.                                                        |
| `Z59.9`  | Housing or economic problem, unspecified                                 | Keep.                                                                                   |


Delete:

- `Z59.00` Homelessness unspecified

### `Z60` Problems related to social environment *


| Code    | Title                                                     | Notes                                                            |
| ------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| `Z60.0` | Phase of life problem                                     | Keep.                                                            |
| `Z60.2` | Problems related to living alone                          | Keep.                                                            |
| `Z60.3` | Acculturation difficulty                                  | Keep.                                                            |
| `Z60.4` | Social exclusion or rejection                             | Keep.                                                            |
| `Z60.5` | Target of perceived adverse discrimination or persecution | Keep.                                                            |
| `Z60.8` | Other specified problems related to social environment *  | Example: inadequate social support or lack of emotional support. |


### `Z62` Problems related to upbringing *

`Z62.810` remains split into the starred childhood abuse history variants plus the combined entry. `Z62.821` and `Z62.822` are removed for now in favor of the broader parent-child conflict entry.


| Code       | Title                                                                | Notes                                                              |
| ---------- | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `Z62.0`    | Inadequate parental supervision and control                          | Keep.                                                              |
| `Z62.1`    | Parental overprotection                                              | Keep.                                                              |
| `Z62.21`   | Child in welfare custody                                             | Keep.                                                              |
| `Z62.22`   | Institutional upbringing                                             | Keep.                                                              |
| `Z62.3`    | Hostility towards and scapegoating of child                          | Add.                                                               |
| `Z62.6`    | Inappropriate excessive parental pressure                            | Keep.                                                              |
| `Z62.810`* | Personal history of physical abuse in childhood *                    | Keep split entry.                                                  |
| `Z62.810`* | Personal history of sexual abuse in childhood *                      | Keep split entry.                                                  |
| `Z62.810`  | Personal history of physical and sexual abuse in childhood           | Keep combined entry.                                               |
| `Z62.811`  | Personal history of psychological abuse in childhood                 | Keep.                                                              |
| `Z62.812`  | Personal history of neglect in childhood                             | Keep.                                                              |
| `Z62.813`  | Personal history of forced labor or sexual exploitation in childhood | Add.                                                               |
| `Z62.814`  | Personal history of child financial abuse                            | Add.                                                               |
| `Z62.815`  | Personal history of intimate partner abuse in childhood              | Add.                                                               |
| `Z62.819`  | Personal history of unspecified abuse in childhood                   | Keep.                                                              |
| `Z62.82`   | Parent-child conflict *                                              | Use broader entry for now.                                         |
| `Z62.89`   | Other specified problems related to upbringing *                     | Example: parent-child estrangement, sibling rivalry, running away. |
| `Z62.9`    | Problem related to upbringing, unspecified *                         | Keep revised wording.                                              |


Delete:

- `Z62.821` Parent-adopted child conflict
- `Z62.822` Parent-foster child conflict

### `Z63` Other problems related to primary support group, including family circumstances *


| Code     | Title                                                                    | Notes                                                                       |
| -------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `Z63.0`  | Problems in relationship with spouse or partner *                        | Revise wording.                                                             |
| `Z63.1`  | Problems in relationship with in-laws                                    | Keep.                                                                       |
| `Z63.31` | Absence of family member due to military deployment                      | Keep.                                                                       |
| `Z63.32` | Other absence of family member                                           | Keep.                                                                       |
| `Z63.4`  | Disappearance and death of a family member *                             | Includes assumed death of a family member and bereavement.                  |
| `Z63.5`  | Disruption of family by separation or divorce                            | Keep and list before `Z63.6`.                                               |
| `Z63.6`  | Dependent relative needing care at home                                  | Keep.                                                                       |
| `Z63.71` | Stress on family due to return of family member from military deployment | Add.                                                                        |
| `Z63.72` | Alcoholism and drug addiction in family                                  | Keep.                                                                       |
| `Z63.79` | Other stressful life events affecting family and household               | Keep.                                                                       |
| `Z63.8`  | Other specified problems related to primary support group *              | Example: inadequate support, discord with family, estrangement from family. |
| `Z63.9`  | Problem related to primary support group, unspecified                    | Keep.                                                                       |


Delete:

- duplicate starred `Z63.4` bereavement-only entry

### `Z64` Problems related to certain psychosocial circumstances *


| Code    | Title                                  | Notes                                                                                            |
| ------- | -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `Z64.0` | Problems related to unwanted pregnancy | Keep.                                                                                            |
| `Z64.1` | Problems related to multiparity        | Keep.                                                                                            |
| `Z64.4` | Discord with counselors *              | Expand note to include probation officers, case managers, social workers, and similar providers. |


### `Z65` Problems related to other psychosocial circumstances *


| Code    | Title                                                            | Notes                                                                         |
| ------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `Z65.0` | Conviction in civil or criminal proceedings without imprisonment | Keep.                                                                         |
| `Z65.1` | Imprisonment or other incarceration                              | Keep.                                                                         |
| `Z65.2` | Problems related to release from prison                          | Keep.                                                                         |
| `Z65.3` | Problems related to other legal circumstances                    | Keep.                                                                         |
| `Z65.4` | Victim of crime and terrorism or torture *                       | Consolidate duplicate `Z65.4` variants into one entry.                        |
| `Z65.5` | Exposure to disaster, war, or other hostilities                  | Keep.                                                                         |
| `Z65.8` | Other specified problems related to psychosocial circumstances   | Add. Example: codependency, loneliness risk, spiritual or religious problems. |


Delete:

- duplicate starred `Z65.4` crime-only entry
- duplicate starred `Z65.4` terrorism-or-torture-only entry
- duplicate unstarred `Z65.4` combined variant with outdated wording

## Survey Interaction Rules

- The survey should run one question at a time instead of stacked cards.
- The primary forward action is a right-arrow next action.
- A low-profile back action should remain available.
- Show a simple overall progress bar at the top.
- Allow both drag-to-score and click-to-score interactions.
- Pulse the selected number briefly after selection.
- Support `not encountered in our work` for conditionally relevant prompts.
- When `not encountered in our work` is selected:
  - disable score input for that prompt
  - persist a row for that prompt with a null score
  - exclude that prompt from burden-score-derived capability calculations

## Supabase Alignment Requirements

- `atlas.z_codes` must contain the active survey codes with corrected titles.
- `atlas.app_config_documents(surface = 'singlepane', config_key = 'service_capacity_survey')` must reflect this taxonomy.
- `atlas.partner_service_capacity_answers` must support null `burden_score` values when `not_encountered = true`.
- `Z58` must be treated as part of the habitat / physical environment family in app mappings and category rollups.

