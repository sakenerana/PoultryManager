# Testing and Release Sign-Off Guide

This guide provides repeatable validation for the GGDC Poultry Management System. Use it before production releases and after changes to Supabase tables, Row Level Security policies, authentication, routes, or farm workflows.

The repository does not currently include an automated unit or end-to-end test suite. The checks below combine available static commands with structured manual acceptance testing.

## Test Principles

- Test against a non-production Supabase project whenever writes or deletes are involved.
- Test each role with a separate account: Admin, Supervisor, and Staff.
- Test both visible navigation and direct URL access.
- Verify saved data by reloading the page and, when appropriate, checking Supabase.
- Confirm calculated totals from their source records instead of checking only that a page rendered.
- Use fixed, identifiable test data and remove it through an approved cleanup process.
- Record failures with the role, route, building, grow, date, expected result, actual result, and browser evidence.

## Release Severity

| Severity | Meaning | Release decision |
| --- | --- | --- |
| Blocker | Authentication bypass, unauthorized write, data loss, corrupted totals, unusable core workflow | Do not release |
| High | Major role restriction failure, broken grow/feed/electricity/harvest workflow, incorrect report totals | Fix before release |
| Medium | Non-critical workflow defect with a practical workaround | Release only with approval |
| Low | Cosmetic or minor usability defect without data impact | Track for follow-up |

## Test Environment

Prepare:

- A dedicated test Supabase project or approved staging dataset
- One active Admin account
- One active Supervisor account
- One active Staff account assigned to Building A
- One inactive account
- Building A with at least two cages
- Building B, not assigned to the Staff account
- One active grow with known starting animal totals
- One harvested grow with truck and reduction history
- Known feed, electricity, body-weight, and mortality values
- A supported desktop browser and a mobile-sized browser/device

Record the environment before testing:

```text
Test date:
Tester:
Source commit:
App version/build:
Deployment URL:
Supabase project:
Browser/device:
Database seed or backup reference:
```

## Automated Checks

### Dependency installation

```bash
npm ci
```

Expected: installation completes using the committed lockfile.

### Lint

```bash
npm run lint
```

Expected: command exits successfully. If existing unrelated lint findings are accepted for a release, record the exact findings and approval; do not report the command as passed.

### TypeScript validation

```bash
npx tsc -b
```

Expected: command exits without TypeScript errors.

### Documentation and whitespace

```bash
git diff --check
```

Expected: no whitespace errors. Line-ending notices are warnings, not whitespace failures.

### Production build

```bash
npm run build
```

Expected: TypeScript and Vite complete successfully and `dist/` is produced.

The build increments `src/generated/appVersion.ts`. Keep the increment for an intended release; restore only that generated file when the build was validation-only.

Known non-fatal build warnings must still be reviewed. A warning is acceptable only when the build exits successfully and its cause is already understood.

### Production preview

```bash
npm run preview
```

Run the manual smoke tests against the preview build as well as the deployed environment.

## Role and Authorization Matrix

The maintained route-by-route reference is [Role and Access Matrix](ROLE_ACCESS_MATRIX.md). The summary below defines the core acceptance expectations used by this testing guide.

This matrix describes the intended business behavior to verify. Supabase RLS must enforce the same restrictions; hiding a button or menu item is not authorization.

| Capability | Admin | Supervisor | Staff |
| --- | --- | --- | --- |
| Sign in when active | Allow | Allow | Allow |
| View assigned operational data | Allow | Allow | Assigned building only |
| Create/manage buildings | Allow | Allow | Deny |
| Enter current daily grow activity | Allow | Allow | Assigned building only |
| Edit previous grow dates | Allow | Deny | Deny |
| Edit/delete load history | Allow | Deny | Deny |
| Undo completed loading | Allow | Deny | Deny |
| Enter new daily feed usage | Allow | Allow | Assigned building only |
| Edit/delete saved feed usage | Allow | Deny | Deny |
| Enter new electricity reading | Allow | Allow | Assigned building only |
| Edit saved electricity reading | Allow | Deny | Deny |
| Manage truck loading for current date | Allow | Allow | Deny unless explicitly approved |
| Edit loaded birds/delete truck records | Allow | Deny | Deny |
| View feed/electricity reports | Allow | Allow | Assigned data only |
| View/manage income summaries | Allow | Deny | Deny |
| Manage user accounts | Allow | Deny | Deny |

Important current-route checks:

- `/reports/income` and `/reports/income/new` use an Admin-only route guard.
- Feed and electricity routes allow all active roles, with page-level restrictions for existing-record edits.
- `/accounts` currently requires a valid session but is not wrapped by the Admin-only route guard in `src/App.tsx`. Treat successful non-admin access or mutation as a release-blocking authorization defect.
- Harvest and building routes also require direct-URL tests because several permissions are enforced within pages rather than at the route boundary.

## Authentication Tests

### Active user login

1. Sign in with each active test account.
2. Confirm the dashboard loads.
3. Refresh the page.
4. Confirm the session remains valid.
5. Sign out and confirm protected pages are no longer accessible.

Expected: each active account can sign in, session refresh works, and sign out returns the user to login.

### Invalid credentials

1. Enter a valid email with an incorrect password.
2. Attempt to sign in.

Expected: access is denied and no protected data is displayed.

### Inactive account

1. Sign in with the inactive account if Supabase Auth still permits authentication.
2. Open feed, electricity, and Admin-only routes directly.

Expected: role-protected routes deny access. Confirm RLS also prevents data access or writes even if the session exists.

### Password recovery

1. Request a reset email from **Forgot Password**.
2. Open the newest email link.
3. Confirm it reaches `/reset-password` on the test domain.
4. Test mismatched and fewer-than-six-character passwords.
5. Set a valid password.
6. Confirm the recovery session signs out and the new password works.

Expected: invalid input is rejected, the valid password is saved, and expired/reused links fail safely.

### Unauthenticated direct routes

Open representative protected URLs in a private session:

- `/landing-page`
- `/buildings`
- `/reports`
- `/accounts`
- `/feeds-consumption`
- `/electricity-consumption`

Expected: redirect to login without exposing page data.

## Building and Grow Tests

### Building visibility

1. Sign in as Admin and confirm Buildings A and B are visible.
2. Repeat as Supervisor.
3. Sign in as Staff assigned to Building A.
4. Confirm only Building A appears.
5. Attempt to open Building B by direct URL.

Expected: Staff cannot read or modify Building B. Validate the Supabase response, not only the page navigation.

### Create a building

1. Sign in as Admin, then repeat as Supervisor.
2. Create a uniquely named test building with its expected cages.
3. Reload the list.
4. Confirm the building and cages exist once.
5. Confirm Staff cannot see building-management controls.

Expected: Admin and Supervisor can create the full building structure; Staff cannot create or alter buildings.

### Start and complete loading

1. Open a test building without an active grow.
2. Enter known animal counts for multiple cages or load transactions.
3. Save and reload.
4. Confirm the displayed total equals the transaction sum.
5. Add another dated load and confirm the total updates once.
6. Complete loading and confirm the grow becomes active/growing.
7. Confirm only Admin can undo completion.

Expected: no duplicate active grow is created and totals remain consistent across the load screen, building overview, and reports.

### Historical load restrictions

1. Open an earlier load date as Admin and edit a test transaction.
2. Repeat as Supervisor and Staff.
3. Attempt edit and delete actions by direct interaction and any reachable direct URL.

Expected: Admin changes persist; Supervisor and Staff changes are rejected by the application and RLS.

## Daily Grow Activity Tests

### Current-day entry

For one cage, record known values for:

- Mortality
- Thinning
- Take Out
- Average weight

Save each value, reload the page, and open the relevant history screens.

Expected: values appear once under the correct building, grow, cage, and date. Remaining animal totals reflect reductions without double deduction.

### Multiple cages

Record different values in two cages on the same day.

Expected: cage values remain separate and building totals equal their sum.

### Previous-date restriction

1. Select an earlier grow date.
2. Edit it as Admin.
3. Repeat as Supervisor and Staff.

Expected: Admin can correct supported history; non-admin roles receive a denial and no database change occurs.

### Closed grow

Open a harvested or otherwise closed grow and attempt to modify cage activity.

Expected: the record is read-only and no write reaches Supabase.

## Daily Feed Tests

The supported workflow is daily-feed-only. Feed Received, Transfer In, and Transfer Out must not appear as active cards or report tabs.

### Create daily feed usage

1. Open **Daily Feed Usage** for the active grow.
2. Select a pending grow day.
3. Enter feed code `510`, `511`, `512`, or `513`.
4. Enter known bag and kilogram quantities.
5. Save and reload.

Expected: the day changes from Pending to Recorded, quantities match, and only one row exists for the grow/day.

### Daily feed target

1. Use a grow with a known initial total and dated `GrowLogs.actual_total_animals` snapshots.
2. Open Days 1, 7, 14, 21, 28, and 30.
3. Confirm the displayed grams per bird are `12`, `35`, `67`, `105`, `145`, and `156` respectively.
4. Confirm target kilograms equal grams per bird multiplied by the latest bird count on or before that day, divided by `1,000`.
5. Save a known actual kilogram value and verify variance equals actual minus target.
6. Open Day 31 and confirm no target is claimed.
7. Switch to another grow and confirm its bird count and target replace the previous grow's values.
8. Confirm each weekly summary adds recorded daily kilograms and adjusted daily targets from Day 1 through that week's guide day.
9. Confirm Week 5 stops cumulative comparison at Day 30 and later weeks do not claim a new cumulative target.
10. Correct an earlier daily record as Admin, reload, and confirm cumulative actual and variance change without relying on the stored cumulative field.
11. Leave one day pending and confirm the recorded-day count is short and cumulative variance shows `Incomplete`.
12. Record the missing day and confirm cumulative variance appears using actual minus adjusted target.

Expected: card and entry-modal targets match, pending days do not show an actual variance, incomplete cumulative periods do not imply zero consumption, and no stale bird basis appears after switching grows.

### Duplicate prevention

Attempt to save the same grow day again.

Expected: the existing `(grow_id, age_day)` record is updated only when the role is allowed; a duplicate row is not created.

### Existing-record permissions

1. Edit and delete a saved entry as Admin.
2. Attempt the same as Supervisor and Staff.

Expected: only Admin can modify or delete the existing record.

### Legacy URL redirect

Open a legacy route such as:

```text
/feeds-consumption/building/1/received?growId=10
```

Expected: redirect to the building's `/daily` route while preserving `growId=10`.

### Feed report

Compare the daily records with the feed report and exported PDF.

Expected: building, grow sequence, dates, codes, bags, kilograms, and totals match the source records. User-facing grow numbers must be building-local sequence numbers rather than database IDs.

## Electricity Tests

### Daily readings

1. Enter a loading/day-0 meter reading.
2. Enter the next day's higher reading.
3. Confirm daily consumption equals current minus previous reading.
4. Reload and verify both values.

Expected: calculation and stored values are consistent.

### Meter reset or replacement

Enter a current reading lower than the previous reading.

Expected: the page warns about the lower reading and supports the documented reset/replacement remarks and manual-consumption workflow without creating a negative total.

### Existing-record permissions

1. Edit a saved reading as Admin.
2. Attempt the same as Supervisor and Staff.

Expected: only Admin can edit saved electricity readings.

### Grow-cycle statuses

Prepare and verify each case:

| Data setup | Expected status | Expected display |
| --- | --- | --- |
| Start and end readings exist | Complete | Total kWh equals end minus start |
| End exists, start absent | Needs start | `Missing start` |
| Start exists, end absent | Needs end | `Missing end` |
| No readings | No records | No fabricated meter value |

Confirm the same status and totals in desktop, mobile, and PDF/report output. Incomplete cycles may use saved daily kWh as the documented fallback.

## Harvest Tests

### Create truck records

1. Open an active grow for harvest.
2. Add two trucks with distinct names and plate numbers.
3. Record empty weight, loaded weight, and animals loaded.
4. Save and reload.
5. Confirm harvest totals equal the truck records.

Expected: each truck remains linked to the correct harvest and grow.

### Role restrictions

1. Manage current-date truck loading as Admin and Supervisor.
2. Attempt the Staff workflow from the dashboard and direct route.
3. Attempt historical edits as each role.
4. Attempt loaded-bird changes and truck deletion as Supervisor and Staff.

Expected: only intended roles can perform each mutation, and RLS rejects unauthorized direct writes.

### Complete harvest

1. Record final reductions and truck totals.
2. Complete the harvest.
3. Confirm the grow is marked harvested.
4. Confirm daily grow editing is disabled.
5. Confirm the grow moves from active to harvested reports.

Expected: animal totals agree across harvest, truck history, and reports.

## Reports and PDF Tests

For each report, compare at least one row and total with source records:

- Active grows
- Harvested grows
- Grow history
- Harvest history
- Daily feed usage
- Electricity consumption
- Income summary

Verify:

- Filters change the displayed dataset correctly.
- Empty states do not show stale totals.
- Building names and building-local grow numbers are correct.
- Dates and units are consistent.
- PDF values match the on-screen report.
- Long names and large totals fit without overlap.
- Admin-only income routes reject Supervisor and Staff direct access.

## Account Management Tests

Account management is intended for Admin only.

1. As Admin, create a Staff account assigned to Building A.
2. Confirm the Auth user and `Users` profile are both created.
3. Edit the full name, role, building assignment, and status.
4. Confirm an Inactive profile loses protected role access.
5. As Supervisor and Staff, open `/accounts` directly and attempt all available actions.

Expected: non-admin roles cannot view sensitive account data or mutate account records. Because the current route is only session-protected, this direct-access case is a mandatory release check and any successful non-admin access is a blocker.

Also verify that deleting an application profile does not create an unexpected orphaned Auth account. Account lifecycle behavior should be documented and approved before production deletion tests.

## Mobile and Responsive Tests

Test at minimum:

- A narrow mobile viewport around 360 CSS pixels wide
- A common phone viewport around 390 CSS pixels wide
- A tablet viewport
- A desktop viewport

On each viewport verify:

- No text, buttons, drawers, cards, or tables overlap.
- Form fields and confirmation actions remain reachable.
- Numeric values are not clipped.
- Headers, back, home, and sign-out controls remain usable.
- Daily feed and electricity rows can be opened and saved.
- Report tables have a usable mobile presentation.
- On-screen keyboard use does not hide required save actions.

## PWA and Update Tests

1. Serve the production build through HTTPS or localhost.
2. Confirm `manifest.webmanifest`, both icons, and `service-worker.js` load successfully.
3. Install the app on a supported device/browser.
4. Confirm launch opens at the application root in standalone mode.
5. Deploy a new build with a new app build number.
6. Select **Sync latest update**.
7. Confirm the update prompt appears, **Update now** activates it, and the app reloads.
8. Confirm the displayed app version changed.
9. Temporarily disconnect the network and confirm the cached application shell loads.
10. Confirm Supabase data writes do not falsely appear successful while offline.

Expected: static shell caching works, API responses are not served as stale cached data, and updates do not leave mixed-build assets.

## Data Integrity Reconciliation

Before release sign-off, reconcile one complete grow:

1. Sum all load transactions.
2. Sum mortality, thinning, take-out, culling, DOA, and transfer effects.
3. Compare the calculated remaining animals with the latest grow log and building overview.
4. Compare harvest truck animal totals with the harvest total.
5. Compare daily feed entries with the feed report.
6. Compare electricity meter differences with daily and grow-cycle totals.
7. Confirm active/harvested status is consistent across dashboard and reports.

Any unexplained difference is a release blocker until its source is understood.

## Release Smoke Test

Run this short set immediately after deployment:

- [ ] Production HTTPS page loads.
- [ ] Active Admin can sign in and sign out.
- [ ] Unauthenticated nested route redirects to login.
- [ ] Staff sees only the assigned building.
- [ ] Non-admin direct access to `/accounts` and income routes is denied.
- [ ] Building and grow lists load from the intended Supabase project.
- [ ] One approved test read and write succeeds.
- [ ] Feed report loads.
- [ ] Electricity report loads with correct status labels.
- [ ] Harvest page loads.
- [ ] One PDF export opens correctly.
- [ ] Password-reset route loads.
- [ ] PWA manifest and service worker return successfully.
- [ ] Displayed app build matches the release record.

## Sign-Off Record

```text
Release:
Source commit:
App version/build:
Environment:
Test database/seed:

Automated checks:
- npm ci:
- lint:
- TypeScript:
- diff check:
- production build:

Manual suites:
- authentication:
- authorization/RLS:
- buildings and grows:
- daily activity:
- feed:
- electricity:
- harvest:
- reports/PDF:
- accounts:
- mobile/PWA:
- data reconciliation:

Open defects and severity:
Approved exceptions:
Tester:
Approver:
Sign-off date:
Result: PASS / FAIL
```

A release passes only when all blocker and high-severity findings are resolved, required evidence is recorded, and the designated approver accepts any remaining exceptions.
