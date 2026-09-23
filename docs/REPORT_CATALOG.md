# Report Catalog

This catalog documents the current GGDC Poultry Management System reports, their data sources, calculations, filters, access rules, and export behavior.

Last reviewed: 2026-09-23

## How to Use This Catalog

- Use the report route and source tables to trace a displayed value.
- Treat a PDF as a snapshot of the filters and stored data available when it was generated.
- Confirm disputed totals against the source records and the rules in [Business Rules](BUSINESS_RULES.md).
- Verify building isolation in Supabase Row Level Security (RLS). A hidden menu item or client-side route guard is not a database security boundary.
- Use database IDs for diagnostics only. User-facing grow labels should normally use the sequence within the selected building.

## Quick Catalog

| Report | Route | Current route access | Primary sources | Export |
| --- | --- | --- | --- | --- |
| Reports menu | `/reports` | Signed-in users | `Grows`, `ElectricityConsumption`, `FeedsConsumption`, `IncomeSummary` | None |
| Active Grows | `/reports/grows` | Signed-in users | `Buildings`, `Grows` | PDF preview |
| Harvested Batches | `/reports/harvested` | Signed-in users | `Buildings`, `Grows` | PDF preview |
| Active Grow History | `/reports/grow/:id/history` | Signed-in users | `Grows`, `Buildings`, `GrowLogs`, `Harvest`, `HarvestReductionTransactions` | PDF preview |
| Harvested Grow History | `/reports/harvested/grow/:id/history` | Signed-in users | `Grows`, `Buildings`, `GrowLogs`, `Harvest`, `HarvestReductionTransactions` | PDF preview |
| Income Summaries | `/reports/income` | Active Admin | `IncomeSummary` | PDF preview |
| Electricity Consumption | `/reports/electricity-consumption` | Active Admin, Supervisor, or Staff | `Buildings`, `Grows`, `ElectricityConsumption` | PDF preview |
| Daily Feed | `/reports/feeds-consumption` | Active Admin, Supervisor, or Staff | `Buildings`, `Grows`, `FeedsConsumption`, `FeedUsageSummary` | PDF download |

The signed-in-only report routes do not perform the same profile-role check as `AdminOnlyRoute`. Their authorized row scope therefore depends on page queries and live RLS policies. See [Security Guide](SECURITY_GUIDE.md).

## Reports Menu

The reports menu is a navigation and high-level activity screen. Its counts are broad summaries loaded from report source tables and are not substitutes for reconciled report totals.

Current tiles:

- **Active Grows**
- **Harvested Batches**
- **Electricity**
- **Daily Feed Report**

The **Income Summaries** route exists and is Admin-only, but its tile is currently hidden from the reports menu. Authorized users must reach the route directly until the menu behavior changes.

## Active Grows

**Route:** `/reports/grows`

**Purpose:** Lists grows that are currently classified as active for a selected building.

**Filters:**

- Building, required; the first available building is selected initially.
- Started date range, applied to `Grows.created_at`.

**Active classification:** A grow is active when `is_harvested` is not `true` and the normalized status is not `harvested`. A missing status is therefore still treated as active.

**Displayed data:** Grow identifier, building, start/created date, loaded bird count from `Grows.total_animals`, and status.

**Summary values:**

- Total grows: number of filtered rows.
- Total birds: sum of filtered `Grows.total_animals` values.
- Average birds per grow: total birds divided by total grows.
- Latest grow: latest filtered `Grows.created_at` value.

**Navigation and export:** Selecting a row opens the Active Grow History report. PDF export is generated in the browser and opened as a preview in a new tab.

**Interpretation warning:** The grow number shown by this report and its PDF is currently the database grow ID, not the building-local sequence used by the Daily Feed report.

## Harvested Batches

**Route:** `/reports/harvested`

**Purpose:** Lists grows classified as harvested for a selected building.

**Filters:**

- Building, required; the first available building is selected initially.
- Started date range, applied to `Grows.created_at`.

**Harvested classification:** A grow is harvested when `is_harvested` is `true` or the normalized status is `harvested`.

**Summary values:**

- Harvested grow count: number of filtered rows.
- Overall birds: sum of filtered `Grows.total_animals` values.
- Average birds per grow: overall birds divided by grow count.
- Latest date: latest filtered `Grows.created_at` value.

**Navigation and export:** Selecting a row opens Harvested Grow History. PDF export is generated in the browser and opened as a preview.

**Interpretation warnings:**

- Overall birds comes from the originally stored grow total. It is not the sum of `Harvest.total_animals_out` or harvest truck records.
- The date filter and latest date use the grow creation/start value, not a dedicated harvest completion timestamp.
- The displayed grow number is currently the database grow ID.

## Active Grow History

**Route:** `/reports/grow/:id/history`

**Purpose:** Shows detailed activity and harvest context for one grow selected by database ID.

**Source records:**

- Grow and building identity from `Grows` and `Buildings`.
- Daily records from `GrowLogs`.
- Harvest entries from `Harvest`.
- Harvest corrections from `HarvestReductionTransactions`.

**Summary values:** Grow log count, harvest entry count, total animals out, harvest reductions, current birds, and grow reductions.

Current birds uses the most recent `GrowLogs.actual_total_animals` value when available, then falls back to `Grows.total_animals`. Grow reductions are calculated from mortality, thinning, and take-out values found in the loaded grow logs.

The chart supports month selection and switches between actual bird totals and daily reductions. Multiple records on the same day are grouped for display.

**Export:** The report provides browser-generated PDF previews for the report summary and grow-log detail.

**Reconciliation warning:** Daily logs may represent snapshots as well as activity. Do not assume that summing every reduction field is equivalent to the canonical transaction-ledger total without checking the data model and [Business Rules](BUSINESS_RULES.md).

## Harvested Grow History

**Route:** `/reports/harvested/grow/:id/history`

**Purpose:** Shows grow, harvest, and harvest-reduction history for a completed batch.

**Summary values:** Grow log count, harvest entry count, total animals out from `Harvest`, and total harvest reductions.

The chart supports month selection and switches between animals out and reductions. Values recorded on the same date are grouped.

**Exports:**

- Summary PDF preview.
- Harvest entries PDF preview with date, status, and animals out.
- Harvest reductions PDF preview with date, harvest ID, reduction type, count, and remarks.

Titles and filenames currently use the database grow ID rather than a building-local grow sequence.

## Income Summaries

**Routes:** `/reports/income` and `/reports/income/new`

**Access:** Active Admin only. The report tile is currently hidden from the reports menu.

**Purpose:** Stores and presents manually prepared production and financial summaries.

**List summary values:** Number of reports, unique farm names, sum of `total_harvest`, and latest valid finish date.

**Displayed data:** Report number, farm name, flock, start date, finish date, PDF/reference status, and row actions. The list is paginated and does not currently provide interactive report filters.

**Export:** Selecting a record generates a detailed PDF in the browser from the saved `IncomeSummary` row and opens a preview.

**Interpretation warnings:**

- Most income-summary values are saved report inputs, not live calculations from grow, feed, electricity, or harvest modules.
- Reconcile the saved values with the relevant operational reports before approval or external distribution.
- Displayed report numbering is derived by the client from year and row ordering; it should not be treated as an immutable database identifier.

## Electricity Consumption

**Route:** `/reports/electricity-consumption`

**Purpose:** Reports saved daily electricity records for a selected building.

**Filters:**

- Building, required; the first available building is selected initially.
- Reading date range.
- Quick ranges for today, current week, current month, and all records.

**Displayed data:** Reading date, grow ID, age day, meter reading, saved consumption in kWh, remarks, and a link to the grow electricity detail.

**Summary values:** Record count, sum of saved `consumption`, average kWh per record, latest reading date, and current-month count and kWh.

**Export:** A filtered PDF is generated in the browser and opened as a preview.

**Important distinction:** This report sums saved daily `ElectricityConsumption.consumption` values. The separate grow-cycle electricity view classifies cycles as `Complete`, `Needs start`, `Needs end`, or `No records`; a complete cycle uses ending meter reading minus starting meter reading. Those two views answer different questions and can differ until the underlying readings are complete and reconciled.

## Daily Feed Report

**Route:** `/reports/feeds-consumption`

**Purpose:** Reports the current daily-feed-only workflow by building and grow.

**Filters:**

- Building, required; the first available building is selected initially.
- Grow status: all, growing, or harvested.
- All grows or one selected grow.
- Record date range.

Grow selectors and exported labels use the sequence within the selected building, such as `Grow #1`.

**Daily Feed Usage columns:** Grow, age day, date, feed code, bags, kilograms, and remarks.

**Feed Code Summary columns:** Grow, feed code, bags, and kilograms.

**Summary values:** Daily record count, sum of daily bags, sum of daily kilograms, and totals grouped by feed code.

The feed-code summary uses `FeedUsageSummary` when matching summary rows are available. When they are not available, it is derived from `FeedsConsumption` daily records.

**Export:** The current filtered report is generated as a client-side PDF download. The filename includes the selected building and applicable grow/status/date context.

**Interpretation warnings:**

- A mismatch between daily totals and feed-code summary totals may indicate manually maintained or stale `FeedUsageSummary` data.
- Received and transfer movement tabs are not part of the current visible workflow or this report.
- An empty report may mean that the building, grow status, grow, and date filters have no common records.

## Identifier Rules

| Context | Current identifier behavior |
| --- | --- |
| Daily Feed report | Building-local grow sequence |
| Active Grows report | Database grow ID |
| Harvested Batches report | Database grow ID |
| Grow history reports | Database grow ID in route, title, and filename |
| Technical troubleshooting | Database IDs are appropriate |

The current inconsistency should be considered when comparing screenshots, PDFs, and source records. Do not infer that `Grow #2` in a building-local feed report means database grow ID `2`.

## Source-to-Report Map

| Source | Reports using it | Main contribution |
| --- | --- | --- |
| `Buildings` | Grow lists, histories, electricity, feed | Building identity and selector options |
| `Grows` | Grow lists, histories, electricity, feed | Grow identity, status, dates, and loaded birds |
| `GrowLogs` | Grow history reports | Daily snapshots and reduction fields |
| `Harvest` | Grow history reports | Harvest entries and animals out |
| `HarvestReductionTransactions` | Grow history reports | Harvest corrections and reductions |
| `ElectricityConsumption` | Electricity report and menu | Readings and saved daily kWh |
| `FeedsConsumption` | Daily Feed report and menu | Daily feed usage |
| `FeedUsageSummary` | Daily Feed report | Optional stored feed-code summaries |
| `IncomeSummary` | Income Summaries and menu | Saved financial and production summaries |

See [Database Guide](DATABASE_GUIDE.md) for the application-used schema and environment overrides.

## Missing and Unexpected Data

When a report is empty or incomplete, check these in order:

1. Confirm the selected building, grow status, grow, and date range.
2. Confirm that the expected source rows exist and use the expected date and grow/building IDs.
3. Confirm that the user profile is active and assigned to the correct building where applicable.
4. Confirm RLS allows the user's role to read only the intended rows.
5. Check whether a report uses a stored summary table or a different date than the operational screen.
6. Reload after correcting data because reports use values loaded into the current page session.

## Reconciliation Checklist

- [ ] Record the route, selected filters, user role, building, grow, and generation time.
- [ ] Compare the displayed rows with the source table rows before comparing summary cards.
- [ ] Confirm whether grow labels are database IDs or building-local sequences.
- [ ] For harvested lists, compare loaded birds separately from actual animals out.
- [ ] For electricity, compare daily saved kWh separately from complete grow-cycle meter differences.
- [ ] For feed, compare `FeedsConsumption` daily totals with `FeedUsageSummary` totals.
- [ ] For income summaries, compare each saved input with its operational source report.
- [ ] Test the same scope using Admin and the relevant restricted role.
- [ ] Preserve the disputed PDF and source values as evidence before editing records.

Use [Testing Guide](TESTING_GUIDE.md) for release validation and [Security Guide](SECURITY_GUIDE.md) for role and RLS checks.

## Update This Catalog When

- A report route, menu tile, role guard, or building scope changes.
- A source table, column, filter, formula, status, or identifier convention changes.
- A report adds, removes, or changes PDF/CSV export behavior.
- A stored summary is replaced with a live calculation, or the reverse.
- A production discrepancy reveals an undocumented interpretation or reconciliation step.

Documentation should describe current behavior and approved rules separately. A documented inconsistency remains a code or data issue until it is corrected and verified.
