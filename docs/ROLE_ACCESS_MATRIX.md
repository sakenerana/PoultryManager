# Role and Access Matrix

This document defines intended access for `Admin`, `Supervisor`, and `Staff` users and records how the current application enforces that access.

Last reviewed: 2026-09-23

## Reading the Matrix

| Term | Meaning |
| --- | --- |
| Allow | The role is intended to use the capability within its approved data scope. |
| Assigned only | Staff access is limited to the building assigned in the `Users` profile and records belonging to that building. |
| Deny | The role is not intended to use the capability. |
| Session guard | `ProtectedRoute` checks only for a valid Supabase Auth session. |
| Active-role guard | `AdminOnlyRoute` checks the latest `Users` profile role and denies an `Inactive` profile. |
| Page check | Visibility or mutation rules are implemented within a page rather than at the route boundary. |
| RLS | Supabase Row Level Security; the required final authorization boundary for frontend database requests. |

This matrix describes intended business access and observed frontend enforcement. It does not confirm that the live database has matching RLS policies.

Required security relationship:

```text
UI visibility <= route permission <= RLS permission
```

## Account Prerequisites

| Condition | Expected result |
| --- | --- |
| No Supabase Auth session | Protected routes redirect to `/`. |
| Auth session with active application profile | Access is evaluated by role, building assignment, page checks, and RLS. |
| Auth session with inactive application profile | Role-protected routes deny access; RLS must also deny protected reads and writes. |
| Auth session with missing or unreadable profile | Access must fail closed. |
| Staff profile without a valid building assignment | Building-scoped operations must be denied until corrected. |
| Duplicate profiles for one Auth user | Treat as a data-integrity defect; the active-role guard currently selects the newest profile. |

`ProtectedRoute` does not load role, status, or building assignment. Any route using only this guard must rely on page checks and RLS for finer authorization.

## Role Scope

| Role | Intended scope |
| --- | --- |
| Admin | Full approved operational access, historical corrections, restricted reports, and account administration. |
| Supervisor | Approved current operations and operational reports without Admin-only historical corrections or account administration. |
| Staff | Current daily operations and operational reports for the assigned building only. |

## Capability Matrix

| Capability | Admin | Supervisor | Staff |
| --- | --- | --- | --- |
| Sign in with an active account | Allow | Allow | Allow |
| View operational data | Allow | Allow | Assigned only |
| Create and manage buildings | Allow | Allow | Deny |
| Load a new grow | Allow | Allow | Deny unless approved policy says otherwise |
| Enter current daily grow activity | Allow | Allow | Assigned only |
| Edit previous grow dates | Allow | Deny | Deny |
| Edit or delete load history | Allow | Deny | Deny |
| Undo completed loading | Allow | Deny | Deny |
| Enter current daily feed usage | Allow | Allow | Assigned only |
| Edit or delete saved feed usage | Allow | Deny | Deny |
| Enter a new electricity reading | Allow | Allow | Assigned only |
| Edit a saved electricity reading | Allow | Deny | Deny |
| Manage current-date harvest truck loading | Allow | Allow | Deny unless explicitly approved |
| Edit loaded birds or delete truck records | Allow | Deny | Deny |
| View active and harvested grow reports | Allow | Allow | Assigned only |
| View feed and electricity reports | Allow | Allow | Assigned only |
| View or manage income summaries | Allow | Deny | Deny |
| View or manage user accounts | Allow | Deny | Deny |
| Change another user's role, status, or building | Allow | Deny | Deny |
| Use personal settings and sign out | Allow | Allow | Allow |

Capabilities marked **Assigned only** require RLS to derive building ownership from `building_id` or from the record's parent grow, harvest, cage, or other related row.

## Route Matrix

### Public and Authentication Routes

| Route | Intended users | Current frontend enforcement | Notes |
| --- | --- | --- | --- |
| `/` | Signed-out users | Public-only route | Authenticated users are redirected to the application. |
| `/forgot-password` | Signed-out users | Public-only route | Starts password recovery. |
| `/reset-password` | Recovery-session users | Public route | Must validate the Supabase recovery session before changing a password. |

### General Protected Routes

These routes are inside `ProtectedRoute`. The route boundary verifies a session but does not itself verify profile role, status, or building assignment.

| Route | Intended access | Current frontend enforcement | Required database boundary |
| --- | --- | --- | --- |
| `/landing-page` | Active Admin, Supervisor, Staff | Session guard plus role-based tile visibility | RLS must scope dashboard counts and source data. |
| `/settings` | Active Admin, Supervisor, Staff | Session guard | User-specific settings must not expose another profile. |
| `/buildings` | Admin and Supervisor management; Staff assigned-building view only if approved | Session guard plus page behavior | Building and child-record RLS. |
| `/building-load/:id` | Admin and approved Supervisor; Staff denied unless explicitly approved | Session guard plus page checks | Grow/load insert and update policies must verify role and building. |
| `/building-cage/:id` | Admin, Supervisor, assigned Staff | Session guard plus page checks | Assigned-building and parent-grow RLS. |
| `/building-metric-history/:id/:metric?` | Admin; approved read access for Supervisor and assigned Staff | Session guard plus page checks | Read scope and Admin-only historical mutation policies. |
| `/building-avg-weight-history/:id` | Admin; approved read access for Supervisor and assigned Staff | Session guard plus page checks | Read scope and Admin-only historical mutation policies. |
| `/harvest` | Admin and Supervisor; Staff denied unless explicitly approved | Session guard; Staff dashboard tile is disabled | Harvest/grow RLS must deny unauthorized direct navigation. |
| `/truck/:id` | Admin and approved Supervisor | Session guard plus page checks | Truck and harvest policies must enforce role, date, and parent building. |
| `/harvest-metric-history/:id/:metric?` | Admin; approved Supervisor read access | Session guard plus page checks | RLS must restrict corrections and building scope. |
| `/harvest-avg-weight-history/:id` | Admin; approved Supervisor read access | Session guard plus page checks | RLS must restrict corrections and building scope. |
| `/harvest-truck-history/:id` | Admin; approved Supervisor read access | Session guard plus page checks | RLS must restrict corrections and building scope. |
| `/reports` | Active Admin, Supervisor, Staff | Session guard plus profile lookup for tile visibility | Report source tables must enforce role and building scope. |
| `/reports/grows` | Admin, Supervisor, assigned Staff | Session guard | `Buildings` and `Grows` RLS must limit visible rows. |
| `/reports/harvested` | Admin, Supervisor, assigned Staff | Session guard | `Buildings` and `Grows` RLS must limit visible rows. |
| `/reports/grow/:id/history` | Admin, Supervisor, assigned Staff | Session guard | All grow, harvest, and reduction source tables must enforce parent building. |
| `/reports/harvested/grow/:id/history` | Admin, Supervisor, assigned Staff | Session guard | All grow, harvest, and reduction source tables must enforce parent building. |
| `/accounts` | Admin only | Session guard only | Current gap: non-admin direct access must be denied by RLS; successful access or mutation is a release blocker. |

### Active-Role Routes

These routes use `AdminOnlyRoute` with `Admin`, `Supervisor`, and `Staff` allowed. The route checks role and rejects an `Inactive` profile, but Staff building scope still depends on page behavior and RLS.

| Route | Intended access | Additional restriction |
| --- | --- | --- |
| `/electricity-consumption` | Admin, Supervisor, assigned Staff | Staff is limited to assigned-building records. |
| `/electricity-consumption/daily` | Admin, Supervisor, assigned Staff | Existing-record corrections are Admin-only. |
| `/electricity-consumption/grow-cycle` | Admin, Supervisor, assigned Staff | Grow and building reads must be scoped. |
| `/electricity-consumption/building/:buildingId` | Admin, Supervisor, assigned Staff | Requested building must match Staff assignment. |
| `/electricity-consumption/grow/:growId` | Admin, Supervisor, assigned Staff | Parent grow must belong to the allowed building. |
| `/feeds-consumption` | Admin, Supervisor, assigned Staff | Staff is limited to assigned-building records. |
| `/feeds-consumption/building/:buildingId` | Admin, Supervisor, assigned Staff | Requested building must match Staff assignment. |
| `/feeds-consumption/building/:buildingId/daily` | Admin, Supervisor, assigned Staff | New current records are allowed; saved-record corrections are Admin-only. |
| `/feeds-consumption/building/:buildingId/:section` | Admin, Supervisor, assigned Staff | Legacy section route redirects to daily feed and preserves applicable query parameters. |
| `/reports/electricity-consumption` | Admin, Supervisor, assigned Staff | Report rows must remain building-scoped. |
| `/reports/feeds-consumption` | Admin, Supervisor, assigned Staff | Report rows must remain building-scoped. |

### Admin-Only Routes

| Route | Intended access | Current frontend enforcement |
| --- | --- | --- |
| `/reports/income` | Active Admin | Default Admin-only active-role guard |
| `/reports/income/new` | Active Admin | Default Admin-only active-role guard |

The Income Summaries tile is currently hidden from the Reports menu, but the routes remain available to authorized Admin users by direct navigation.

## UI Visibility

Current dashboard behavior includes:

- The **Accounts** tile is shown only to Admin.
- Admin and Supervisor can open the add-building workflow; Staff receives a denial message.
- The **Harvest** tile is disabled for Staff.
- Feed and electricity report tiles require a recognized active profile.
- The Income Summaries report tile is hidden.

These controls improve navigation but do not authorize database access. Users can type a route directly or call Supabase outside the visible UI.

## Data-Operation Matrix

The live RLS policy set should be tested independently for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.

| Data group | Admin | Supervisor | Staff |
| --- | --- | --- | --- |
| `Users` profiles | Full approved administration | No sensitive list or mutation | Own minimum profile fields only if required |
| Buildings and cages | Full approved access | Approved management access | Assigned-building read only unless policy grants a specific write |
| Grows, loads, daily logs, body weights | Full access including corrections | Current operational access | Assigned-building current operations |
| Feed and electricity | Full CRUD | Read and insert current records | Read and insert assigned-building current records |
| Harvest and trucks | Full CRUD | Approved current harvest operations | Deny unless explicitly approved |
| Operational reports | All approved rows | Approved operational rows | Assigned-building rows only |
| Income summaries | Full CRUD | Deny | Deny |

Where a child table does not contain `building_id`, its policy must resolve ownership through a trusted parent relationship. Updates must validate both the existing row and any new parent ID so a user cannot move a record into another building or grow.

## Known Authorization Risks

1. `/accounts` is intended for Admin only but currently has only a session route guard.
2. Most building, harvest, and operational report routes are session-protected and depend on page checks plus RLS.
3. A hidden or disabled dashboard tile does not prevent direct route navigation.
4. Active-role guards select the newest matching user profile when duplicates exist; database uniqueness is preferable.
5. The repository does not contain a complete authoritative RLS baseline for every application table.
6. Inactive users may retain a valid Auth session, so database policies must check application-profile status.

See [Security Guide](SECURITY_GUIDE.md) for control requirements and incident handling.

## Verification Checklist

- [ ] Test with separate active Admin, Supervisor, and assigned Staff accounts.
- [ ] Test an inactive account and a session with no usable application profile.
- [ ] Open every restricted route directly, not only through dashboard tiles.
- [ ] Verify Staff cannot read or write another building by changing route IDs or request payload parent IDs.
- [ ] Test `SELECT`, `INSERT`, `UPDATE`, and `DELETE` separately on each sensitive table.
- [ ] Confirm Supervisor cannot perform historical corrections, account administration, or income-summary operations.
- [ ] Confirm saved feed and electricity records can be corrected only by Admin.
- [ ] Confirm Staff cannot access harvest unless business policy and RLS explicitly allow it.
- [ ] Confirm report PDFs contain only rows the current role is authorized to read.
- [ ] Record the tested source commit, app build, Supabase environment, policies, and evidence.

Use [Testing Guide](TESTING_GUIDE.md) for detailed test procedures and [Report Catalog](REPORT_CATALOG.md) for report-specific access and source records.

## Update This Matrix When

- A role, account status, building assignment rule, route guard, page check, or RLS policy changes.
- A dashboard tile or direct route becomes visible to another role.
- A role gains or loses a read, create, correction, deletion, export, or account-management capability.
- A security review confirms that current enforcement differs from intended access.

Documenting a permission does not implement it. Any mismatch between intended access and current enforcement must be tracked as a code, policy, or database issue and verified after correction.
