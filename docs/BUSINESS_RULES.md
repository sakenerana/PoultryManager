# Business Rules Reference

This document describes the operational rules currently implemented by the GGDC Poultry Management System. It explains how grow labels, bird totals, feed values, electricity consumption, harvest values, statuses, and role restrictions are interpreted by the application.

These are application rules, not a substitute for approved farm, accounting, or regulatory policy. Business owners should review this document whenever operating procedures change. When approved policy and application behavior differ, record the difference and update the software or procedure deliberately.

## Core Terms

| Term | Meaning in the system |
| --- | --- |
| Building | A poultry house managed as the top-level operational unit |
| Cage / Sub-building | A subdivision of a building used for cage-level activity and weight records |
| Grow | One broiler production cycle within a building |
| Loading Day / Day 0 | The baseline day for grow and electricity records |
| Mortality | Birds found dead during the grow or harvest workflow |
| DOA | Birds dead on arrival during loading |
| Culling / Culled | Birds deliberately removed because they should not remain in the flock |
| Thinning | Birds removed as part of a planned partial removal activity |
| Take Out | Other birds removed from a cage or grow |
| Transfer | Movement of birds affecting a grow or building total |
| Remaining Birds | Non-negative bird balance after applicable reductions |
| Average Weight | Average of valid positive samples, or a saved direct average when available |
| Harvest | Removal of birds from a grow using one or more truck records |

## Record Identity and Display Labels

### Database identifiers

Database `id` values identify records internally. They can contain gaps and must not be interpreted as a business sequence.

### Grow sequence numbers

User-facing grow labels are calculated separately for each building.

1. Grows for a building are ordered by creation/start time.
2. If two grows have the same time, the lower database ID sorts first.
3. The first grow is displayed as `Grow #1`, the next as `Grow #2`, and so on.

The sequence restarts for every building. Therefore, Building A and Building B can both have a `Grow #1`.

Reports and filenames should use this building-local sequence rather than exposing the database grow ID.

## Dates and Grow Days

- Operational entries belong to the selected calendar date, not necessarily the date on which the user entered them.
- Grow-day numbering is derived from the grow start/loading date where the page generates daily rows.
- Electricity uses day `0` as the loading-day baseline.
- Feed records use `age_day` and `record_date` together.
- Historical corrections must retain the intended effective date.
- Calculations that aggregate reductions include records before the end of the selected day.

Users must confirm the building, grow, day, and date before saving because reports group data by those values.

## Grow Lifecycle

The main grow statuses are:

| Status | Meaning | Main behavior |
| --- | --- | --- |
| `Loading` | Chicks and load transactions are still being recorded | Loading history can continue to change the grow total |
| `Growing` | Loading is complete and daily production activity is active | Daily cage, feed, electricity, and report workflows operate against the grow |
| `Harvested` | The grow has been fully harvested or explicitly completed | Daily grow and harvest entry screens become read-only or unavailable |

Lifecycle:

```text
Loading -> Growing -> Harvested
```

- Completing building loading changes the grow from `Loading` to `Growing`.
- Only Admin can undo loading completion and return the grow to `Loading`.
- Completing harvest changes the grow status to `Harvested` and sets its harvested flag.
- A building should not have multiple active `Loading` or `Growing` grows at the same time.

## Bird Count Rules

### Initial grow total

The grow-level starting total is recalculated from load transactions and DOA records:

```text
loaded animals = sum(LoadTransactions.animal_count)
DOA total      = sum(DOATransactions.total_animals_count)
grow total     = max(0, loaded animals - DOA total)
```

`Grows.total_animals` stores the resulting non-negative grow total.

### Daily reduction total

Daily grow reductions use these types:

- `mortality`
- `thinning`
- `take_out`

When multiple reduction transaction versions exist for the same date, cage, and reduction type, the application uses the latest transaction for that combination. It does not sum every historical version of the same daily cage metric.

```text
daily reduction key = date + cage + reduction type
cumulative reductions = sum(latest value for each daily reduction key)
```

### Current animal total

The displayed current animal total is calculated as:

```text
current animals = max(
  0,
  grow total - cumulative grow reductions - cumulative culled total
)
```

The application clamps bird balances to zero; negative remaining-bird totals are not displayed or saved by these calculations.

### Corrections

Editing an existing daily metric replaces the value represented by that date/cage/type rather than adding the correction as another operational loss.

Only Admin can edit supported previous-date grow activity. Current-day entry remains available according to role and building access.

### Transfers

Transfer transactions are considered when loading and reporting grow balances. A transfer must retain its source/destination and effective date so that it affects the correct grow. Because transfer direction can alter more than one building, reconcile both sides after any correction.

## Body Weight Rules

The body-weight helper resolves an average in this order:

1. Use a saved positive `avg_weight` when present.
2. Otherwise combine positive numeric samples from front, middle, and back areas.
3. Ignore zero, negative, missing, and non-numeric sample values.
4. Return no average when there are no valid samples.

```text
average body weight = sum(all valid positive samples) / count(valid positive samples)
```

All samples included in one average must use the same unit. The application does not convert mixed units.

## Feed Rules

### Current workflow scope

The active operator workflow is daily feed usage only.

- Daily entries save to `FeedsConsumption`.
- Feed Received, Transfer In, and Transfer Out are legacy movement workflows and are not shown as active operator sections.
- Legacy section URLs redirect to the daily feed page and preserve query parameters such as `growId`.

Legacy movement data can still contribute to building summary values and must not be deleted without checking reports and existing records.

### Feed codes

Current selectable feed codes are:

- `510`
- `511`
- `512`
- `513`

A blank feed code is technically representable by the data model, but normal daily entry should use an approved code.

### One record per grow day

Daily feed entries are upserted using:

```text
(grow_id, age_day)
```

The intended rule is one daily feed record per grow and age day. Saving the same grow/day should update the existing row when the user has permission rather than create a duplicate.

### Daily and cumulative quantities

```text
daily bags = feed_quantity_bags
daily kg   = feed_quantity_kg
cumulative feed kg = previous recorded cumulative kg + current daily kg
```

Because cumulative kilograms are saved, changing an earlier day can make later saved cumulative values stale unless they are recalculated. After a historical feed correction, verify subsequent days and the report total.

### Remaining birds in feed records

Feed records preserve mortality and remaining-bird helper fields:

```text
remaining birds = max(
  0,
  previous remaining birds - mortality dead - mortality culling
)
```

The current daily form hides those mortality fields and preserves existing values. Grow logs and reduction transactions remain the primary operational source for daily mortality activity.

### Feed summary formulas

The building feed summary distinguishes **Overall** from **Net**:

```text
Overall bags = used bags + received bags + transfer-in bags + transfer-out bags

Net bags = received bags + transfer-in bags - used bags - transfer-out bags
```

`Overall` measures total recorded bag activity across categories. It is not available inventory. `Net` is the movement-style balance represented by the available legacy movement records.

### Feed permissions

- Active roles can open daily feed pages according to their data access.
- Staff should be restricted to their assigned building.
- Only Admin can edit or delete an existing daily feed record.

## Electricity Rules

### Daily meter readings

Day `0` is the loading-day baseline and has no calculated daily consumption.

For later days:

```text
daily kWh = max(0, current meter reading - previous day's meter reading)
```

If a saved manual consumption value exists, the application uses it. If either required meter reading is missing, calculated daily consumption is unavailable.

### Meter reset or replacement

A current reading lower than the previous reading indicates a possible reset, replacement, or entry error.

- The application warns the user.
- The user should verify the physical reading.
- A meter reset/replacement must be noted in remarks.
- Manual consumption can be used for that day.
- The application must not produce negative consumption.

### Grow-cycle electricity status

| Status | Rule | Display/action |
| --- | --- | --- |
| `No records` | The grow has no electricity entries | Add daily records |
| `Needs start` | Entries exist but there is no day-0 reading | Display `Missing start` and add the baseline |
| `Needs end` | A day-0 reading exists but fewer than two readings are available | Display `Missing end` and add a later/final reading |
| `Complete` | Day 0 and at least one later reading exist | Use ending reading minus starting reading |

The start reading is the day-0 reading when available. The end reading is the latest reading in the grow's ordered entries.

```text
complete grow kWh = max(0, end meter reading - start meter reading)
```

For an incomplete grow cycle, the summary falls back to the sum of saved daily `consumption` values.

Desktop, mobile, reports, and PDF exports should show the same status and total.

### Electricity permissions

- Active roles can create a new electricity record according to their data access.
- Staff should be restricted to their assigned building.
- Only Admin can edit an already saved electricity reading.

## Harvest Rules

### Truck lifecycle

| Truck status | Meaning |
| --- | --- |
| `Loading` | Truck exists but final loaded values have not been completed |
| `Completed` | Loaded weight and bird count have been saved |

New truck and harvest records start in `Loading` status. Completing a truck saves its loaded weight and animals loaded, then changes the truck to `Completed`.

### Truck weights

```text
net truck weight = weight with load - empty truck weight

average bird weight = net truck weight / animals loaded
```

Average bird weight is unavailable when animals loaded is zero. Empty and loaded weights must use the same unit, and the resulting average uses that unit per bird. Aggregate harvest views clamp negative net weight to zero, but the per-truck calculation uses the direct difference. A loaded weight below the empty weight is invalid input that must be corrected rather than interpreted as a valid negative average.

### Harvest animal total

When a completed truck's animal count changes, the harvest total changes by the difference:

```text
animals-loaded delta = new truck animals - previous truck animals
new harvested total  = max(0, existing harvested total + delta)
```

This prevents an edited truck from being counted twice.

### Harvest remaining birds

```text
harvest remaining = max(
  0,
  grow total - total animals harvested - harvest reductions
)
```

Harvest reductions can include mortality, thinning, take-out, and defect records.

When harvest remaining reaches zero:

1. The harvest is marked `Completed`.
2. The grow status becomes `Harvested`.
3. The grow harvested flag is set.
4. Further grow and harvest edits are restricted by the relevant screens.

### Harvest permissions

- Admin and Supervisor can manage current harvest truck loading where enabled.
- Staff harvest access is disabled in the dashboard and must remain restricted by database policy.
- Only Admin can delete truck records or edit protected loaded-bird values.
- Completed/harvested grows are not open for normal further loading.

## Report Rules

- Reports must use the same source records and formulas as operational pages.
- PDF totals must match the filtered on-screen totals.
- Empty filters must not retain totals from a previous selection.
- Grow labels must use building-local sequence numbers.
- Feed and electricity PDFs must preserve their current units and completeness statuses.
- Historical corrections must be visible after data is reloaded.

When a report and operational page disagree, reconcile the underlying records before distributing the report.

## Income Summary Rules

`IncomeSummary` stores a wide broiler summary containing farm information, dates, bird totals, mortality, performance figures, feed phases, harvest values, rates, payment figures, and a PDF/reference URL.

Many fields are entered or reviewed in the form rather than derived live from all operational modules. Therefore:

- Do not assume an income value automatically changes when feed, harvest, or electricity data changes.
- Reconcile operational source reports before finalizing an income summary.
- Use one approved unit and rate basis for every calculation.
- Review saved values and the referenced PDF before treating the report as final.
- Treat the module as a saved summary, not an accounting ledger or payment authorization system.

## Role and Status Rules

### Account status

| Status | Meaning |
| --- | --- |
| `Active` | Account is eligible for role-protected application access |
| `Inactive` | Role-protected access must be denied |

Supabase Auth session validity and application profile status are separate. An Auth session can exist while an application profile is inactive, so route checks and RLS policies must enforce status.

### Roles

| Role | Business scope |
| --- | --- |
| Admin | Full operational oversight, historical corrections, account management, and restricted reports |
| Supervisor | Current operational management and approved reports without Admin-only corrections |
| Staff | Daily work for the specifically assigned building |

Important restrictions:

- Admin and Supervisor can manage building setup.
- Staff building lists must be limited to the assigned building.
- Only Admin can edit previous grow dates, load history, saved feed entries, and saved electricity readings.
- Only Admin can manage accounts and income summaries.
- Hiding a control is not sufficient authorization; Supabase RLS must reject unauthorized direct reads and writes.

## Data Invariants

The following conditions should always remain true:

- Bird counts and calculated remaining totals are never negative.
- A building has at most one active grow.
- Every cage belongs to a valid building.
- Operational records belong to the correct grow and building.
- Grow-day and record-date values describe the same operational day.
- A feed grow/day has at most one daily feed entry.
- An electricity grow/day has at most one intended daily reading.
- Truck records belong to the correct harvest.
- Harvested totals and reductions do not exceed the grow total without an investigated explanation.
- Staff cannot read or modify data outside the assigned building.
- Inactive profiles cannot use role-protected operations.
- Reports and PDF exports reproduce the same filtered totals shown on screen.

## Reconciliation Checklist

For one complete grow, verify:

```text
1. grow total = loaded animals - DOA
2. current animals = grow total - grow reductions - culling adjustments
3. harvested total = sum of effective truck animal counts
4. harvest remaining = grow total - harvested total - harvest reductions
5. daily feed sum = feed report total
6. final electricity total = end reading - start reading
7. grow status and harvested flag agree with the remaining balance
```

All balances are clamped at zero by the application, but a displayed zero does not prove the source records are correct. Investigate over-counted reductions, duplicate days, and incorrect dates whenever the raw arithmetic would be negative.

## Rule Change Procedure

When a business rule changes:

1. Obtain the approved rule, formula, units, effective date, and responsible owner.
2. Identify every affected entry screen, table, summary, report, PDF, and historical record.
3. Decide whether the change applies only to new records or also recalculates history.
4. Update database constraints or RLS policies when enforcement changes.
5. Update application calculations and validation.
6. Update this document, the user guide, database guide, and testing guide.
7. Test every role and reconcile representative grows before release.
8. Record the rule change in the release notes.

Never silently reinterpret historical farm data under a new formula without an approved migration and reconciliation plan.
