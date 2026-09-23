# Supabase Database Guide

This guide documents the Supabase tables, columns, and relationships used by the GGDC Poultry Management System.

It is based on the application's TypeScript models and Supabase queries. The repository does not currently contain authoritative SQL migrations, index definitions, triggers, or Row Level Security policies. Verify those details in the Supabase dashboard before changing the production schema.

## Relationship Overview

```text
auth.users
  |-- Users.user_uuid

Buildings
  |-- Subbuildings.building_id
  |-- Users.building_id
  |-- Grows.building_id
  |-- BodyWeightLogs.building_id
  |-- GrowReductionTransactions.building_id
  |-- Harvest.building_id
  `-- FeedsConsumption.building_id

Grows
  |-- Load.grow_id
  |     `-- LoadTransactions.load_id
  |-- GrowLogs.grow_id
  |     `-- GrowReductionTransactions.grow_log_id
  |-- BodyWeightLogs.grow_id
  |-- Harvest.grow_id
  |     |-- HarvestTrucks.harvest_id
  |     |-- HarvestLogs.harvest_id
  |     `-- HarvestReductionTransactions.harvest_id
  |-- ElectricityConsumption.grow_id
  `-- FeedsConsumption.grow_id
```

The relationships above describe how the application joins and filters records. Confirm whether each relationship is enforced by a database foreign key before relying on cascade behavior.

## Naming and Types

- Table names use title case by default, such as `Buildings` and `GrowLogs`.
- Database column names use `snake_case`.
- TypeScript records map database columns to `camelCase` for application use.
- Most operational tables use `id` as the primary identifier and `created_at` as the creation timestamp.
- Foreign identifiers are generally numeric, while `Users.user_uuid` stores the Supabase Auth UUID.
- Optional table names can be overridden with the `VITE_SUPABASE_*_TABLE` environment variables listed in the main README.

## Access and Setup Tables

### `Users`

Application profile and authorization metadata linked to Supabase Auth.

| Column | Purpose |
| --- | --- |
| `id` | Application user record identifier |
| `full_name` | User's display name |
| `role` | `Admin`, `Supervisor`, or `Staff` |
| `building_id` | Building assigned to a Staff account; normally null for wider-access roles |
| `status` | `Active` or `Inactive` |
| `user_uuid` | UUID of the related `auth.users` account |
| `created_at` | Record creation timestamp |

Application relationships:

- `user_uuid` maps to `auth.users.id`.
- `building_id` maps to `Buildings.id` for building-restricted Staff accounts.

The email and password belong to Supabase Auth and are not stored by the application in the `Users` table.

### `Buildings`

Top-level poultry house or building record.

| Column | Purpose |
| --- | --- |
| `id` | Building identifier |
| `name` | User-facing building name |
| `created_at` | Record creation timestamp |

A building can have multiple cages, grows, feed records, and related operational records.

### `Subbuildings`

Cages or subdivisions belonging to a building.

| Column | Purpose |
| --- | --- |
| `id` | Cage/sub-building identifier |
| `building_id` | Parent building |
| `name` | User-facing cage/sub-building name |
| `created_at` | Record creation timestamp |

Application relationship: `building_id` maps to `Buildings.id`.

## Grow and Loading Tables

### `Grows`

Represents one broiler grow cycle within a building.

| Column | Purpose |
| --- | --- |
| `id` | Grow identifier |
| `building_id` | Building running the grow |
| `total_animals` | Current or maintained grow-level animal total |
| `status` | Workflow status such as `Loading` or `Growing` |
| `is_harvested` | Whether the grow has been harvested |
| `created_at` | Grow creation/start timestamp used by several day calculations |

Application relationship: `building_id` maps to `Buildings.id`.

User-facing labels such as `Grow #1` are calculated in building-local chronological order. They are not the value of `Grows.id`.

### `Load`

Header record for a grow loading event.

| Column | Purpose |
| --- | --- |
| `id` | Load identifier |
| `grow_id` | Related grow |
| `truck_plate_no` | Source truck plate number, when recorded |
| `status` | Load workflow status |
| `created_at` | Load transaction date/time |

Application relationship: `grow_id` maps to `Grows.id`.

### `LoadTransactions`

Animal-count entries belonging to a load.

| Column | Purpose |
| --- | --- |
| `id` | Transaction identifier |
| `load_id` | Parent load |
| `animal_count` | Animals included in the transaction |
| `created_at` | Transaction timestamp |

Application relationship: `load_id` maps to `Load.id`.

## Daily Grow Tables

### `GrowLogs`

Daily grow snapshot, optionally scoped to a cage.

| Column | Purpose |
| --- | --- |
| `id` | Log identifier |
| `grow_id` | Related grow |
| `subbuilding_id` | Related cage/sub-building |
| `actual_total_animals` | Remaining animal count at the snapshot |
| `mortality` | Mortality total represented by the snapshot |
| `thinning` | Thinning total represented by the snapshot |
| `take_out` | Take-out total represented by the snapshot |
| `created_at` | Effective log date/time |

Application relationships:

- `grow_id` maps to `Grows.id`.
- `subbuilding_id` maps to `Subbuildings.id`.

### `GrowReductionTransactions`

Detailed grow reduction transactions supporting daily grow snapshots.

| Column | Purpose |
| --- | --- |
| `id` | Reduction identifier |
| `building_id` | Related building |
| `subbuilding_id` | Related cage/sub-building |
| `grow_id` | Related grow |
| `grow_log_id` | Related daily grow log |
| `animal_count_to_deduct` | Number of animals removed from the total |
| `reduction_type` | `mortality`, `thinning`, or `take_out` |
| `remarks` | Optional explanation |
| `created_at` | Effective transaction date/time |

Some deployments may expose the count as `animal_count`; the application defaults to `animal_count_to_deduct` and supports an environment override.

### `BodyWeightLogs`

Cage-level body-weight measurements.

| Column | Purpose |
| --- | --- |
| `id` | Weight log identifier |
| `building_id` | Related building |
| `subbuilding_id` | Related cage/sub-building |
| `grow_id` | Related grow |
| `avg_weight` | Calculated or entered average weight |
| `front_weight` | JSON value containing front-area samples |
| `middle_weight` | JSON value containing middle-area samples |
| `back_weight` | JSON value containing back-area samples |
| `created_at` | Effective measurement date/time |

### `DOATransactions`

Tracks dead-on-arrival reductions associated with grow loading and history.

Application-used columns include `id`, `grow_id`, `building_id`, the configured animal-count column, remarks, and transaction timestamps. Verify the live table before changing this schema because it does not have a dedicated TypeScript row model.

### `CulledTransactions`

Tracks culled-animal reductions for a grow and cage.

Application-used data includes the grow, building/cage context, animal count, remarks, and effective timestamp. Verify exact production constraints in Supabase.

### `TransferTransactions`

Tracks animal transfers affecting grow totals.

Application queries associate transfers with a source grow and building information and use them when recalculating animal totals. Verify direction/source/destination columns in the live schema before migrations because this table does not have a dedicated TypeScript row model.

## Harvest Tables

### `Harvest`

Grow-level harvest header.

| Column | Purpose |
| --- | --- |
| `id` | Harvest identifier |
| `building_id` | Related building |
| `grow_id` | Related grow |
| `status` | Harvest workflow status |
| `total_animals_out` | Total animals removed for harvest |
| `created_at` | Harvest creation timestamp |

The total-animal column name can be overridden. Older schemas may expose a shortened or alternate form, which the application maps defensively.

### `HarvestTrucks`

Truck-level harvest details.

| Column | Purpose |
| --- | --- |
| `id` | Truck record identifier |
| `harvest_id` | Parent harvest |
| `name` | Truck or driver label |
| `plate_no` | Vehicle plate number |
| `weight_no_load` | Empty truck weight |
| `weight_with_load` | Loaded truck weight |
| `animals_loaded` | Animals loaded on the truck |
| `status` | Truck workflow status |
| `created_at` | Record creation timestamp |

Weight and animal column names support environment overrides for compatibility with older schemas.

### `HarvestLogs`

Daily or event-level harvest snapshot.

| Column | Purpose |
| --- | --- |
| `id` | Log identifier |
| `harvest_id` | Parent harvest |
| `mortality` | Mortality count |
| `thinning` | Thinning count |
| `takeout` | Take-out count |
| `defect` | Defect count |
| `created_at` | Event timestamp |

### `HarvestReductionTransactions`

Detailed reductions linked to a harvest log.

| Column | Purpose |
| --- | --- |
| `id` | Reduction identifier |
| `harvest_id` | Parent harvest |
| `harvest_log_id` | Parent harvest log |
| `animal_count_to_deduct` | Number of animals deducted |
| `reduction_type` | `mortality`, `thinning`, `takeout`/`take_out`, or `defect` |
| `remarks` | Optional explanation |
| `created_at` | Event timestamp |

The animal-count and reduction-type column names support environment overrides.

## Feed and Electricity Tables

### `FeedsConsumption`

Current daily feed-usage record. The application upserts one entry per grow day using the conflict target `grow_id,age_day`.

| Column | Purpose |
| --- | --- |
| `id` | Feed entry identifier |
| `building_id` | Related building |
| `grow_id` | Related grow |
| `age_day` | Grow day number |
| `record_date` | Calendar date of use |
| `feed_code` | Feed code such as `510`, `511`, `512`, or `513` |
| `feed_standard` | Preserved standard feed value |
| `feed_quantity_bags` | Bags used that day |
| `feed_quantity_kg` | Kilograms used that day |
| `cumulative_feed_kg` | Running feed total in kilograms |
| `mortality_dead` | Preserved mortality value used by the record model |
| `mortality_culling` | Preserved culling value used by the record model |
| `remaining_birds` | Remaining birds represented by the entry |
| `remarks` | Optional explanation |

Recommended database rule: a unique constraint on `(grow_id, age_day)` should match the application's upsert behavior.

### `FeedUsageSummary`

Summary source used by feed reporting where available. The application treats it as report-oriented data rather than the primary daily entry table. Verify its exact columns and whether it is a table or view in Supabase before modifying it.

### Legacy Feed Movement Tables

The following tables remain referenced by older code but are not part of the current visible daily-feed-only workflow:

- `FeedReceived`
- `FeedTransferIn`
- `FeedTransferOut`

Do not remove or redesign these tables solely because their screens are hidden. Check existing data, views, reports, and external integrations first.

### `ElectricityConsumption`

Daily meter readings for a grow.

| Column | Purpose |
| --- | --- |
| `id` | Electricity entry identifier |
| `grow_id` | Related grow |
| `date` | Calendar date of the reading |
| `day` | Grow day number; day `0` is the loading/start reading |
| `meter_reading` | Physical meter reading |
| `consumption` | Daily kWh, normally calculated from consecutive readings |
| `remarks` | Notes, including meter-reset/replacement explanations |

The grow-cycle summary uses the ending reading minus the starting reading when both are available. When readings are incomplete, reports can fall back to saved daily consumption.

Recommended database rule: prevent duplicate rows for the same grow and day if the production workflow expects one daily reading.

## Financial Reporting Table

### `IncomeSummary`

Stores the Broiler Summary Report and financial calculations. The form reads and writes a wide record rather than normalizing each report section into child tables.

Important column groups:

| Group | Representative columns |
| --- | --- |
| Farm identity | `farm_name`, `flock`, `house`, `code`, `area`, `address`, `vat_reg_no` |
| Dates | `date_start`, `harvest_start`, `date_finish`, `harvest_period` |
| Bird totals | `total_doc_load`, `total_doc_start`, `total_harvest`, `mortality`, `mortality_percent`, `DOA`, `Dead`, `Cull`, `first_week` |
| Performance | `eff`, `adg`, `fcr_actual`, `fcr_std`, `fcr_diff`, `alw`, `unaccounted_birds` |
| Feed phases | Columns for feed-code bags, kilograms, percentages, and feed per head |
| Harvest | `harvest_qty`, `harvest_kilo`, harvest recovery values |
| Rates | `growers_fee_rate`, `performance_efficiency_rate`, `bonus_fc_rate`, `harvest_recovery_rate`, `lpg_rate`, `electricity_rate` |
| Payment | `avg_scheme`, `cash_bond_rate`, calculated payment summary fields |
| Document | `pdf_url` |

Some income-summary identifiers and totals are generated or calculated in the UI. Review the entire form payload before renaming columns.

## RPC Functions

The grow controller supports these configurable Supabase RPC names:

| Environment variable | Default function |
| --- | --- |
| `VITE_SUPABASE_RPC_CREATE_GROW` | `rpc_create_grow_bundle` |
| `VITE_SUPABASE_RPC_UPDATE_GROW` | `rpc_update_grow_bundle` |
| `VITE_SUPABASE_RPC_DELETE_GROW` | `rpc_delete_grow_bundle` |

The application includes direct-table fallback behavior for grow bundles. Keep RPC arguments and return values compatible with the controller before enabling or changing these functions.

## Integrity Recommendations

Before applying these recommendations, compare them with the live schema and clean any conflicting data.

- Enforce foreign keys for the parent-child relationships shown above where operationally appropriate.
- Add a unique constraint for `FeedsConsumption(grow_id, age_day)` to match the current upsert.
- Consider a unique constraint for `ElectricityConsumption(grow_id, day)` if only one reading per grow day is allowed.
- Index frequently filtered foreign-key columns such as `building_id`, `grow_id`, `load_id`, `harvest_id`, and `subbuilding_id`.
- Index date columns used in history and report filters.
- Define cascade behavior deliberately; deleting a building or grow can affect many operational records.
- Keep `Users.user_uuid` unique if every Auth account must have exactly one application profile.
- Restrict direct writes with RLS policies based on authenticated user role and building assignment.

## Schema Change Checklist

1. Export or inspect the current Supabase schema, constraints, indexes, triggers, functions, and RLS policies.
2. Search the repository for the table and column names being changed.
3. Check for an existing `VITE_SUPABASE_*` compatibility override.
4. Back up affected production data.
5. Apply the migration in a non-production environment first.
6. Test Admin, Supervisor, and Staff access separately.
7. Test create, update, report, and delete behavior for the affected module.
8. Verify PDF/report totals and mobile views.
9. Deploy the application and database changes in a compatible order.

Never place the Supabase service-role key in a `VITE_*` variable or browser code. The frontend should use the public client key and rely on Supabase Auth and RLS for authorization.
