# GGDC Poultry Management System

GGDC Poultry Management System is a React, TypeScript, Vite, Ant Design, Tailwind CSS, and Supabase application for managing broiler farm operations. It supports building setup, grow-cycle loading, daily mortality and weight tracking, harvest monitoring, electricity consumption, daily feed usage, income summaries, reports, user accounts, and mobile-friendly field workflows.

## Documentation

- [Documentation Hub](docs/README.md) - audience-based navigation, ownership, and maintenance guidance for the full documentation set
- [Changelog](CHANGELOG.md) - unreleased changes and the standard format for future release notes
- [Architecture Guide](docs/ARCHITECTURE.md) - runtime structure, module boundaries, data flow, PWA lifecycle, extension patterns, and technical risks
- [Security Guide](docs/SECURITY_GUIDE.md) - trust boundaries, authentication, RLS expectations, account security, incidents, and credential handling
- [Role and Access Matrix](docs/ROLE_ACCESS_MATRIX.md) - intended permissions, current route enforcement, building scope, and required RLS boundaries
- [System Administrator Runbook](docs/SYSTEM_ADMIN_RUNBOOK.md) - recurring account, setup, correction, report, release, backup, and incident procedures
- [User Guide](docs/USER_GUIDE.md) - daily workflows for farm staff, supervisors, and administrators
- [Farm Operations Checklist](docs/FARM_OPERATIONS_CHECKLIST.md) - printable daily, harvest, closeout, exception, and supervisor sign-off procedure
- [Staff Training Guide](docs/STAFF_TRAINING_GUIDE.md) - role-based onboarding, practical exercises, competency assessment, and production-access sign-off
- [Client Handover Guide](docs/CLIENT_HANDOVER.md) - environment ownership, delivered scope, UAT, known limitations, support terms, and acceptance sign-off
- [Database Guide](docs/DATABASE_GUIDE.md) - Supabase tables, relationships, application-used columns, and schema change guidance
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) - production build, hosting, PWA updates, verification, backup, and rollback procedures
- [Testing Guide](docs/TESTING_GUIDE.md) - role-based acceptance tests, regression checks, data reconciliation, and release sign-off
- [Business Rules](docs/BUSINESS_RULES.md) - operational definitions, lifecycle rules, formulas, statuses, and permissions
- [Report Catalog](docs/REPORT_CATALOG.md) - report routes, access, filters, sources, calculations, exports, and reconciliation notes

## Core Modules

### Authentication and Access

- Supabase Auth handles sign-in, sign-out, password reset, and active sessions.
- `ProtectedRoute` requires a valid Supabase session before opening operational pages.
- `AdminOnlyRoute` checks the `Users` table for role and status before opening restricted pages.
- Supported roles are `Admin`, `Supervisor`, and `Staff`.
- `Staff` users can be assigned to a specific building; Admin and Supervisor users have wider access.
- Inactive users are denied role-protected access.

### Dashboard

The landing page gives quick access to:

- My Growers
- Harvest
- Reports
- Electricity Consumption
- Daily Feed Usage
- Settings
- Accounts

Admins and Supervisors can add new buildings from the landing page. A new building also creates its cage/sub-building records.

### Buildings and Grow Cycles

The building workflow manages the active broiler batch per building.

- Buildings are stored in `Buildings`.
- Cages/sub-buildings are stored in `Subbuildings`.
- Grow batches are stored in `Grows`.
- Load records are stored in `Load` and `LoadTransactions`.
- Daily grow snapshots are stored in `GrowLogs`.
- Body weight records are stored in `BodyWeightLogs`.
- DOA, culled, and transfer transactions are tracked in their own transaction tables.

Main screens:

- `/buildings` - building overview
- `/building-load/:id` - load a new grow cycle into a building
- `/building-cage/:id` - cage-level daily activity
- `/building-metric-history/:id/:metric?` - metric history
- `/building-avg-weight-history/:id` - average weight history

### Daily Grow Tracking

Users can record and review:

- Current bird count
- DOA reductions
- Culled reductions
- Transfer adjustments
- Cage-level activity
- Average body weight
- Daily grow snapshots

Grow display labels use building-local sequence numbers where applicable. This keeps user-facing labels such as `Grow #1`, `Grow #2`, and report filenames understandable without exposing database IDs.

### Harvest

The harvest module manages completed grow cycles and truck-level harvest details.

- Harvest records are stored in `Harvest`.
- Truck records are stored in `HarvestTrucks`.
- Harvest activity logs are stored in `HarvestLogs`.
- Harvest reductions are stored in `HarvestReductionTransactions`.

Main screens:

- `/harvest` - harvest building selection and harvest overview
- `/truck/:id` - truck loading and harvest details
- `/harvest-metric-history/:id/:metric?` - harvest metric history
- `/harvest-avg-weight-history/:id` - harvest average weight history
- `/harvest-truck-history/:id` - truck history

### Electricity Consumption

The electricity module records daily meter readings and reports consumption by building or grow cycle.

- Daily records are stored in `ElectricityConsumption`.
- A complete grow-cycle kWh value is calculated from ending meter reading minus starting meter reading.
- Incomplete grow-cycle data falls back to saved daily kWh where needed.
- Shared data statuses are used across desktop views, mobile views, and PDF exports:
  - `Complete`
  - `Needs start`
  - `Needs end`
  - `No records`
- Missing readings display as `Missing start` or `Missing end`.

Main screens:

- `/electricity-consumption`
- `/electricity-consumption/daily`
- `/electricity-consumption/grow-cycle`
- `/electricity-consumption/building/:buildingId`
- `/electricity-consumption/grow/:growId`
- `/reports/electricity-consumption`

### Daily Feed Usage

The current feed workflow is daily-feed-only.

- Daily feed usage saves to `FeedsConsumption`.
- Feed codes are managed in `src/utils/feedCodes.ts`.
- Current feed code options are `510`, `511`, `512`, and `513`.
- Legacy feed movement screens for received, transfer-in, and transfer-out are no longer part of the visible routed workflow.
- Legacy section URLs under `/feeds-consumption/building/:buildingId/:section` redirect to the daily feed page while preserving query parameters such as `growId`.

Daily feed reports can also read from `FeedUsageSummary` for summary data.

Main screens:

- `/feeds-consumption`
- `/feeds-consumption/building/:buildingId`
- `/feeds-consumption/building/:buildingId/daily`
- `/reports/feeds-consumption`

### Reports

The reports center groups operational, harvest, income, electricity, and feed reporting.

Main screens:

- `/reports` - reports menu
- `/reports/grows` - active grows report
- `/reports/harvested` - harvested grows report
- `/reports/grow/:id/history` - active grow history
- `/reports/harvested/grow/:id/history` - harvested grow history
- `/reports/income` - income report
- `/reports/income/new` - income summary form
- `/reports/electricity-consumption` - electricity report
- `/reports/feeds-consumption` - daily feed report

Several reports support PDF export through `jspdf` and `jspdf-autotable`.

### Income Summary

The income module records financial and production summary data in `IncomeSummary`.

It includes fields for:

- Harvest/head totals
- Mortality and culling figures
- Feed phase usage
- Grower's fee rate
- Electricity rate
- PDF/reference URL

The default PDF URL is controlled by `VITE_BROILER_SUMMARY_PDF_URL`, with a fallback of `/docs/broiler-summary-sample.pdf`.

### Account Management

Admins can manage user records from `/accounts`.

Account records include:

- Full name
- Supabase user UUID
- Role
- Status
- Building access for Staff users

New users are created through the app and stored in Supabase Auth plus the `Users` table.

### Settings and PWA Support

The settings page supports:

- Text size preference
- Local preview of text size
- Saving preferences to local storage
- PWA install prompt handling
- Sign out

The app registers service-worker/update behavior through the app update indicator and service worker registration files.

## Route Map

Public routes:

- `/` - login
- `/forgot-password` - request reset
- `/reset-password` - reset password

Protected routes:

- `/landing-page`
- `/buildings`
- `/building-load/:id`
- `/building-cage/:id`
- `/building-metric-history/:id/:metric?`
- `/building-avg-weight-history/:id`
- `/harvest`
- `/truck/:id`
- `/harvest-metric-history/:id/:metric?`
- `/harvest-avg-weight-history/:id`
- `/harvest-truck-history/:id`
- `/reports`
- `/reports/grows`
- `/reports/harvested`
- `/reports/grow/:id/history`
- `/reports/harvested/grow/:id/history`
- `/settings`
- `/accounts`

Role-protected routes:

- `/reports/income`
- `/reports/income/new`
- `/reports/electricity-consumption`
- `/reports/feeds-consumption`
- `/electricity-consumption`
- `/electricity-consumption/daily`
- `/electricity-consumption/grow-cycle`
- `/electricity-consumption/building/:buildingId`
- `/electricity-consumption/grow/:growId`
- `/feeds-consumption`
- `/feeds-consumption/building/:buildingId`
- `/feeds-consumption/building/:buildingId/daily`

Unknown routes redirect to `/`.

## Data Model Summary

Primary Supabase tables used by the app:

- `Users`
- `Buildings`
- `Subbuildings`
- `Grows`
- `Load`
- `LoadTransactions`
- `GrowLogs`
- `GrowReductionTransactions`
- `BodyWeightLogs`
- `DOATransactions`
- `CulledTransactions`
- `TransferTransactions`
- `Harvest`
- `HarvestTrucks`
- `HarvestLogs`
- `HarvestReductionTransactions`
- `ElectricityConsumption`
- `FeedsConsumption`
- `FeedUsageSummary`
- `IncomeSummary`

Legacy feed movement tables still appear in older code paths but are not part of the current visible feed workflow:

- `FeedReceived`
- `FeedTransferIn`
- `FeedTransferOut`

## Environment Variables

Required Supabase connection variables:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Optional table-name overrides:

```env
VITE_SUPABASE_USERS_TABLE=Users
VITE_SUPABASE_BUILDINGS_TABLE=Buildings
VITE_SUPABASE_SUBBUILDINGS_TABLE=Subbuildings
VITE_SUPABASE_GROWS_TABLE=Grows
VITE_SUPABASE_LOAD_TABLE=Load
VITE_SUPABASE_LOAD_TRANSACTIONS_TABLE=LoadTransactions
VITE_SUPABASE_GROW_LOGS_TABLE=GrowLogs
VITE_SUPABASE_GROW_REDUCTION_TRANSACTIONS_TABLE=GrowReductionTransactions
VITE_SUPABASE_BODY_WEIGHT_LOGS_TABLE=BodyWeightLogs
VITE_SUPABASE_DOA_TRANSACTIONS_TABLE=DOATransactions
VITE_SUPABASE_CULLED_TRANSACTIONS_TABLE=CulledTransactions
VITE_SUPABASE_TRANSFER_TRANSACTIONS_TABLE=TransferTransactions
VITE_SUPABASE_HARVEST_TABLE=Harvest
VITE_SUPABASE_HARVEST_TRUCKS_TABLE=HarvestTrucks
VITE_SUPABASE_HARVEST_LOGS_TABLE=HarvestLogs
VITE_SUPABASE_HARVEST_REDUCTION_TRANSACTIONS_TABLE=HarvestReductionTransactions
VITE_SUPABASE_ELECTRICITY_CONSUMPTION_TABLE=ElectricityConsumption
VITE_SUPABASE_FEEDS_CONSUMPTION_TABLE=FeedsConsumption
VITE_SUPABASE_FEED_USAGE_SUMMARY_TABLE=FeedUsageSummary
VITE_SUPABASE_INCOME_SUMMARY_TABLE=IncomeSummary
VITE_SUPABASE_FEED_RECEIVED_TABLE=FeedReceived
VITE_SUPABASE_FEED_TRANSFER_IN_TABLE=FeedTransferIn
VITE_SUPABASE_FEED_TRANSFER_OUT_TABLE=FeedTransferOut
```

Optional column/function overrides:

```env
VITE_SUPABASE_REDUCTION_ANIMAL_COUNT_COLUMN=animal_count_to_deduct
VITE_SUPABASE_HARVEST_TOTAL_ANIMALS_COLUMN=total_animals_out
VITE_SUPABASE_HARVEST_TRUCK_WEIGHT_NO_LOAD_COLUMN=weight_no_load
VITE_SUPABASE_HARVEST_TRUCK_WEIGHT_WITH_LOAD_COLUMN=weight_with_load
VITE_SUPABASE_HARVEST_TRUCK_ANIMALS_LOADED_COLUMN=animals_loaded
VITE_SUPABASE_HARVEST_REDUCTION_ANIMAL_COUNT_COLUMN=animal_count_to_deduct
VITE_SUPABASE_HARVEST_REDUCTION_TYPE_COLUMN=reduction_type
VITE_SUPABASE_RPC_CREATE_GROW=rpc_create_grow_bundle
VITE_SUPABASE_RPC_UPDATE_GROW=rpc_update_grow_bundle
VITE_SUPABASE_RPC_DELETE_GROW=rpc_delete_grow_bundle
VITE_BROILER_SUMMARY_PDF_URL=/docs/broiler-summary-sample.pdf
```

## Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Run linting:

```bash
npm run lint
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Build Notes

The `prebuild` script runs `scripts/increment-build-version.mjs` before production builds. This updates `src/generated/appVersion.ts`.

If you run a build only for validation and do not intend to commit a version bump, restore only `src/generated/appVersion.ts` afterward.

## Project Structure

```text
src/
  App.tsx                         Route definitions
  context/AuthContext.tsx         Supabase auth session provider
  components/                     Shared route guards and UI helpers
  controller/                     Supabase CRUD helpers
  pages/                          Feature pages and reports
  type/                           Shared TypeScript data types
  utils/                          Supabase client, auth helpers, settings, feed/grow utilities
  generated/appVersion.ts         Generated build version
```

## Operational Notes

- Keep the feed module daily-feed-only unless the business explicitly reopens feed movement workflows.
- Use building-local grow sequence labels for client-facing grow names and feed report filenames.
- Preserve shared electricity data-status behavior across desktop, mobile, and PDF outputs.
- Avoid committing generated build-version changes unless the change is intended as a release/build update.
- When changing Supabase table names, prefer environment overrides before editing application logic.
