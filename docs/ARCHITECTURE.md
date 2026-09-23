# Application Architecture

This document describes the current architecture of the GGDC Poultry Management System for developers and technical maintainers.

It explains runtime structure, module boundaries, authentication, authorization, data access, state ownership, reporting, PWA behavior, build flow, safe extension points, and known architectural risks.

## System Context

The application is a browser-based React single-page application backed directly by Supabase.

```text
User browser
  |
  |-- React pages and components
  |-- React Router navigation
  |-- Local page state and user settings
  |-- Client-side PDF generation
  |-- Service worker and PWA cache
  |
  `-- Supabase JavaScript client
        |-- Supabase Auth
        |-- Postgres tables through REST
        `-- Grow bundle RPC functions where configured
```

There is no separate application API server in this repository. The browser communicates with Supabase using the public anonymous key. Supabase Row Level Security is therefore a primary security boundary.

## Technology Stack

| Area | Technology |
| --- | --- |
| UI runtime | React 19 and React DOM |
| Language | TypeScript, with JavaScript used by service-worker registration |
| Build tool | Vite 7 |
| Routing | React Router |
| Component library | Ant Design |
| Styling | Tailwind CSS through the Vite plugin plus `src/index.css` |
| Backend client | `@supabase/supabase-js` |
| Charts | `@ant-design/charts` |
| PDF generation | `jspdf` and `jspdf-autotable` |
| Icons | Lucide, Ant Design icons, React Icons, and static assets |
| PWA | Custom web manifest, service worker, and update indicator |

## Runtime Boot Sequence

The application starts in `src/main.tsx`:

```text
1. Import global styles.
2. Load saved user settings from localStorage.
3. Apply text size, theme class, and primary-color CSS variables.
4. Register the service worker after the window load event.
5. Mount React in StrictMode.
6. Wrap the application in AuthProvider.
7. Render App, the update indicator, router, guards, and current page.
```

`StrictMode` can run development lifecycle behavior more than once. Effects that fetch or subscribe must support cleanup and stale-result protection.

## Source Structure

```text
src/
  main.tsx                     Browser bootstrap
  App.tsx                      Route tree and route-level guards
  context/                     Cross-application React context
  components/                  Shared route guards and UI utilities
  pages/                       Route-level screens and feature workflows
  controller/                  Reusable Supabase CRUD/data mapping functions
  type/                        Database-row and application-record types
  utils/                       Shared clients, calculations, settings, and helpers
  generated/                   Build-generated application version
  index.css                    Global Tailwind and application styles

public/
  manifest.webmanifest         PWA metadata
  service-worker.js            Cache and offline shell behavior
  icons/                       PWA icons
  img/                         Application imagery

scripts/
  increment-build-version.mjs  Prebuild version increment

docs/                          Operational and technical documentation
```

## Layer Responsibilities

### Application entry and routing

`src/main.tsx` owns startup. `src/App.tsx` owns route registration, route grouping, unknown-route redirects, and the hidden legacy feed-section redirect.

New top-level routes belong in `App.tsx`. Route authorization should be declared at the route boundary whenever possible instead of relying only on a hidden dashboard tile.

### Pages

Files under `src/pages/` are route-level feature components. They commonly own:

- Screen layout and responsive behavior
- Form and drawer state
- Supabase query lifecycle
- Mapping query rows into display models
- User feedback and confirmation flows
- Feature-specific calculations
- PDF export preparation

Several pages are intentionally substantial because the current architecture is page-oriented. New work should avoid adding unrelated responsibilities to an already large page; extract reusable calculations or data operations when more than one screen needs them.

### Components

`src/components/` contains shared application-level behavior:

- `ProtectedRoute` - requires a Supabase session.
- `PublicRoute` - redirects authenticated users away from login/public pages.
- `AdminOnlyRoute` - loads role/status from `Users` and checks allowed roles.
- `AppUpdateIndicator` - displays service-worker update state and applies waiting updates.
- `NotificationToast` - shared notification presentation where used.

Feature-specific cards and forms are often defined inside their page rather than as separate component modules.

### Controllers

`src/controller/` contains reusable CRUD functions and database-to-application mapping for:

- Buildings
- Sub-buildings/cages
- Grows and loads
- Grow logs and reductions
- Body weights
- Harvests and trucks
- Harvest logs and reductions
- Users

Controllers generally:

1. Resolve default or environment-overridden table names.
2. Build Supabase queries or RPC calls.
3. Map `snake_case` database rows into `camelCase` application records.
4. Throw Supabase errors or return a typed result, depending on the controller.

The controller layer is not used consistently by every feature. Feed, electricity, income, dashboard summaries, and many report queries access Supabase directly from pages.

### Types

`src/type/` defines manually maintained row types, input types, filters, and application records for core modules.

The project does not currently use Supabase-generated database types. Manual types can drift from the live schema, especially where older deployments use alternate or truncated column names.

### Utilities

Shared utilities include:

- `supabase.ts` - the singleton browser Supabase client.
- `auth.ts` - shared sign-out-and-redirect helper.
- `bodyWeight.ts` - body-weight average resolution.
- `feedCodes.ts` - approved feed-code options.
- `growSequence.ts` - building-local grow numbering and labels.
- `userSettings.ts` - local settings persistence and application.

Shared domain calculations should live in utilities when multiple pages or exports must produce the same result.

## Routing Architecture

`BrowserRouter` provides client-side routes. Static hosting must rewrite unknown application URLs to `/index.html` while serving real assets directly.

Route groups:

```text
PublicRoute
  |-- /
  `-- /forgot-password

Unwrapped recovery route
  `-- /reset-password

ProtectedRoute
  |-- dashboard, buildings, grow activity, harvest, reports, settings, accounts
  |-- AdminOnlyRoute
  |     `-- income report routes
  `-- AdminOnlyRoute with all active roles
        `-- feed and electricity routes
```

Unknown routes redirect to `/`.

The feed compatibility route `/feeds-consumption/building/:buildingId/:section` redirects to `/daily` and preserves query parameters. The old movement page remains in the source tree but is not imported by the active router.

## Authentication Flow

`AuthProvider` centralizes the Supabase Auth session:

```text
App startup
  -> supabase.auth.getSession()
  -> set session and user
  -> subscribe to onAuthStateChange()
  -> expose session, user, loading, sign-in, and sign-out through useAuth()
```

Sign-in calls `supabase.auth.signInWithPassword`. Sign-out calls `supabase.auth.signOut`.

The remember-me choice is stored under `ggdc_remember_me`, but session persistence is still provided by the Supabase client. Any future change to remember-me semantics must account for Supabase storage behavior rather than only the local flag.

Password recovery is handled outside the normal public-route wrapper so a recovery session can open `/reset-password`.

## Authorization Flow

Authorization exists at three levels:

```text
Route guard
  -> page-level role/building checks
  -> Supabase RLS and database permissions
```

### Route guards

- `ProtectedRoute` checks only for an authenticated session.
- `AdminOnlyRoute` loads the latest `Users` row by `user_uuid`, checks `role`, and rejects `Inactive` profiles.
- It can accept a custom list of allowed roles.

### Page-level checks

Several pages load the `Users` profile to enforce building visibility and mutation rules. Examples include Admin-only historical corrections, Admin/Supervisor building management, Staff building filtering, and Admin-only edits of saved feed/electricity records.

### RLS

Frontend guards improve navigation and feedback, but they are not a security boundary. Supabase RLS must independently enforce role, status, and assigned-building access for every table and RPC.

Current authorization is mixed between routes and pages. For example, `/accounts` is session-protected but not wrapped in the Admin-only route guard even though account management is intended for Admin. The testing guide treats non-admin direct access as release-blocking.

## Data Access Architecture

### Supabase client

`src/utils/supabase.ts` creates one client from:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Both values are embedded into the frontend build. The anonymous key is public by design; the service-role key must never be used in this client.

### Controller-based flow

```text
Page event/effect
  -> controller function
  -> Supabase table or RPC
  -> row mapping
  -> typed application record
  -> page state
  -> UI
```

This pattern is used most clearly by building, grow, body-weight, harvest, and user CRUD operations.

### Direct-query flow

```text
Page event/effect
  -> Supabase query
  -> local row type or inline mapping
  -> page state/calculation
  -> UI or PDF
```

Direct access is common in reports and workflows that join several tables in application code. This keeps queries close to their presentation but increases duplication and makes cross-page consistency harder to maintain.

### RPC flow

Grow creation, update, and deletion can use configurable RPC functions:

- `rpc_create_grow_bundle`
- `rpc_update_grow_bundle`
- `rpc_delete_grow_bundle`

The grow controller includes direct-table fallback behavior. RPC and fallback paths must preserve the same transaction semantics and response expectations.

## State Management

The application does not use a global state-management library.

State is owned by:

- `AuthContext` for the Supabase session and user.
- Individual pages for fetched records, forms, filters, drawers, loading, and error state.
- React Router location, path parameters, query parameters, and navigation state for screen context.
- `localStorage` for user settings and the remember-me preference.
- Supabase as the persistent source of operational records.

This keeps module state local but can duplicate user-profile loading and shared summary calculations across pages.

When adding shared state, first determine whether it should be server state, route state, local UI state, or a pure derived value. Do not introduce global state solely to avoid passing a small amount of page-local data.

## Module Boundaries

| Module | Primary pages | Data access |
| --- | --- | --- |
| Authentication | `LoginPage`, `ForgotPasswordPage`, `ResetPasswordPage` | `AuthContext` and direct Supabase Auth |
| Dashboard | `LandingPage` | Direct summary queries and role lookup |
| Buildings and grows | `BuildingPage`, `BuildingLoadPage`, `BuildingCage`, history pages | Controllers plus direct multi-table queries |
| Harvest | `HarvestBuildingPage`, `HarvestTruckPage`, harvest history pages | Harvest controllers plus direct grow/log queries |
| Daily feed | `FeedsConsumptionPage`, building/menu/daily pages, report page | Direct Supabase queries and shared feed/grow utilities |
| Electricity | Overview, form, and report pages | Direct Supabase queries and page-level calculations |
| Reports | Reports menu and grow/harvest history pages | Direct multi-table queries and client-side aggregation |
| Income summary | Income list and form pages | Direct `IncomeSummary` queries and client-side form mapping |
| Accounts | `AccountsPage` | `userCrud` plus Supabase Auth sign-up |
| Settings | `SettingsPage` | `localStorage`, CSS variables/classes, PWA install prompt |

## Domain Calculation Ownership

Calculations that appear in multiple screens or exports must produce identical results.

Current shared helpers:

- Body-weight averaging is centralized in `src/utils/bodyWeight.ts`.
- Feed codes are centralized in `src/utils/feedCodes.ts`.
- Building-local grow numbering is centralized in `src/utils/growSequence.ts`.

Other calculations remain embedded in pages, including animal-balance reconciliation, feed cumulative values, electricity completeness, and harvest totals. When changing one of these rules:

1. Search every operational page, report, mobile view, and PDF export that implements it.
2. Update the Business Rules document.
3. Add or update regression cases in the Testing Guide.
4. Prefer extracting a pure shared helper when the same formula has multiple consumers.

The Business Rules document is the human-readable formula reference; the deployed code remains the current implementation.

## Reporting Architecture

Reports query Supabase directly, combine data in the browser, apply filters, and generate PDFs with jsPDF.

```text
Supabase rows
  -> page-level normalization
  -> filters and aggregation
  -> responsive screen model
  -> jsPDF table/export model
```

Desktop, mobile, and PDF output often share a mapped row model within a page. Preserve that pattern when adding statuses or calculations so outputs do not drift.

PDF generation is client-side. Large datasets affect browser memory and processing time, and exported values are only as current as the rows loaded by the page.

## PWA Architecture

### Registration and update signaling

`src/serviceWorkerRegistration.js` registers `/service-worker.js` after page load. It publishes update state through a browser custom event named `pwa-update-state`.

`AppUpdateIndicator` listens for that event and displays update, success, error, or ready states.

```text
User selects sync/update
  -> registration.update()
  -> new worker installs and waits
  -> UI shows "Update now"
  -> postMessage({ type: "SKIP_WAITING" })
  -> controllerchange event
  -> page reload
```

### Cache strategy

`public/service-worker.js`:

- Pre-caches the application root, `index.html`, and manifest.
- Uses network-first navigation with cached `index.html` fallback.
- Uses cache-first plus background network refresh behavior for same-origin static resources.
- Bypasses Supabase and JSON/API requests.
- Deletes cache names other than the current static/runtime versions during activation.

The manifest, service-worker registration path, pre-cache URLs, and asset paths assume root-domain deployment. Subpath hosting requires coordinated changes.

## Build and Version Architecture

```text
npm run build
  -> prebuild
     -> scripts/increment-build-version.mjs
     -> update src/generated/appVersion.ts
  -> tsc -b
  -> vite build
  -> dist/
```

The application version is visible in the UI and helps identify deployed builds. A validation build also increments the generated source file, so release tooling must decide whether to retain or restore that specific change.

Routes are imported eagerly in `App.tsx`; the current build does not use route-level lazy loading. This can contribute to a large initial JavaScript chunk as the application grows.

## Error and Loading Behavior

The application primarily uses:

- Page-local loading flags
- Full-page or section loading states
- Toast/notification messages
- Ant Design confirmation dialogs
- Console logging for selected query and update errors
- Try/catch around asynchronous page workflows

There is no application-wide error boundary or centralized telemetry client in the current source. Critical failures should produce a user-facing message and enough non-sensitive context for support without exposing credentials or private data.

## Safe Extension Patterns

### Add a new page

1. Create the route-level component under `src/pages/`.
2. Add the route to the correct guard group in `src/App.tsx`.
3. Add dashboard/report navigation only for intended roles.
4. Add matching RLS policies before relying on frontend restrictions.
5. Add direct-route and role tests to the Testing Guide.
6. Update the route map and relevant user documentation.

### Add reusable data access

1. Add or extend a typed controller when multiple pages need the operation.
2. Keep database row mapping at the data boundary.
3. Support existing environment table/column overrides where applicable.
4. Define whether errors are thrown or returned and use the pattern consistently.
5. Test both RPC and fallback paths when modifying grow bundles.

### Add a shared business calculation

1. Define inputs and units explicitly.
2. Implement it as a pure utility when possible.
3. Use the same helper in operational, report, mobile, and PDF paths.
4. Add boundary tests for zero, missing, duplicate, and historical values.
5. Update Business Rules and Testing Guide.

### Add a Supabase table or column

1. Create an approved migration and rollback plan outside or inside the repository's future migration system.
2. Add RLS and indexes with the schema change.
3. Update or generate TypeScript types.
4. Add an environment override only when compatibility requires it.
5. Update the Database Guide and deployment record.

## Known Architectural Risks

### Authorization is distributed

Role enforcement is split across route guards, page checks, hidden UI controls, and expected RLS. A route or page can be missed when permissions change.

Direction: define a centralized access policy, align route guards with it, and verify equivalent RLS for every data operation.

### Data access is mixed

Controllers and direct page queries coexist. Inline mapping and business formulas are repeated across large pages and reports.

Direction: extract shared data services and pure calculations incrementally when duplication affects correctness or maintainability.

### Database schema is not versioned here

The repository has no authoritative Supabase migration history, generated database types, or checked-in RLS definitions.

Direction: adopt versioned migrations and generated types before broad schema refactoring.

### Automated coverage is absent

There is no configured unit, integration, or browser test runner. Release confidence depends heavily on the manual Testing Guide.

Direction: begin with pure calculation tests and a small set of authentication/critical-workflow browser tests.

### Routes are eagerly loaded

All pages are statically imported by `App.tsx`, increasing the initial bundle as features grow.

Direction: introduce route-level lazy loading in a focused performance change after measuring real load impact.

### Password reset origin is hardcoded

The forgot-password flow currently contains the production reset URL in the page source.

Direction: move the public application origin or reset URL to validated environment configuration before supporting multiple deployment domains.

### PWA assumes root hosting

Manifest, service worker, icons, and pre-cache paths begin at `/`.

Direction: keep root deployment or update all base/scope/path assumptions together.

### Account creation spans two systems

Creating a user first creates a Supabase Auth account and then inserts a `Users` profile. A failure between those operations can leave an Auth account without an application profile.

Direction: move privileged account provisioning to a trusted server-side function with explicit rollback or reconciliation.

### Client-side summaries can drift

Reports and dashboards aggregate rows in the browser. Historical corrections, duplicate records, or formula duplication can produce inconsistencies.

Direction: centralize high-value summaries in tested shared functions, database views, or RPCs while preserving role-aware access.

## Architectural Decision Checklist

Before introducing a new dependency, service, global state layer, or data abstraction, record:

- The problem and affected workflows
- Why existing patterns are insufficient
- Security and RLS impact
- Data ownership and source of truth
- Offline/PWA implications
- Migration and compatibility requirements
- Test strategy
- Deployment and rollback plan
- Documentation affected

Prefer narrow changes that align with current module boundaries. Introduce a new abstraction only when it removes meaningful duplication, centralizes a business rule, or establishes a needed security boundary.
