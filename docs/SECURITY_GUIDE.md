# Security Guide

This guide documents the security model, trust boundaries, implemented controls, required Supabase protections, known risks, testing expectations, and incident-response procedures for the GGDC Poultry Management System.

It distinguishes controls visible in this repository from protections that must be verified in the deployed hosting and Supabase environments. Documentation does not prove that a policy is active in production.

## Security Objectives

The system should protect:

- User accounts and authentication sessions
- Role and account-status assignments
- Staff building assignments
- Bird, feed, electricity, harvest, and financial records
- Historical corrections and deletions
- Production configuration and deployment integrity
- Traceability of sensitive administrative actions

The main authorization objective is least privilege: users should access only the modules, buildings, records, and mutations required by their role.

## Trust Boundaries

```text
Untrusted browser input
  |
  |-- React UI and route guards
  |-- Supabase browser client using public credentials
  |
  `-- Supabase boundary
        |-- Auth session validation
        |-- RLS policies
        |-- Table grants and constraints
        |-- RPC authorization
        `-- Database records

Trusted administrative systems
  |-- Supabase dashboard / approved migrations
  |-- Hosting environment configuration
  |-- Backup and recovery controls
  `-- Deployment and incident operators
```

The browser is not trusted. Users can inspect JavaScript, alter requests, call Supabase directly, and attempt routes hidden by the UI. Route guards and disabled controls improve user experience but cannot replace RLS.

## Data Classification

| Classification | Examples | Handling |
| --- | --- | --- |
| Public application data | PWA manifest, icons, public frontend code | May be cached and distributed publicly |
| Internal operational data | Buildings, grows, bird counts, feed, electricity, harvest records | Authenticated, role- and building-scoped access |
| Restricted business data | Income summaries, rates, financial report links | Admin-only unless policy explicitly approves wider access |
| Restricted identity data | Names, emails, Auth UUIDs, roles, account status | Admin-managed; disclose only when operationally required |
| Secret credentials | Service-role keys, database passwords, provider tokens | Never place in browser code, `VITE_*`, documentation, logs, or screenshots |

The Supabase anonymous/public key is not a secret, but it grants the capabilities allowed by database grants and RLS. Weak RLS turns a public key into a path to unauthorized data.

## Current Implemented Controls

Controls visible in the source include:

- Supabase Auth email/password sessions.
- `AuthProvider` session bootstrap and auth-state subscription.
- `ProtectedRoute` for authenticated route groups.
- `PublicRoute` to redirect authenticated users away from login pages.
- `AdminOnlyRoute` role/status lookup through the `Users` table.
- Page-level role checks for selected historical edits, feed/electricity changes, building management, and truck actions.
- Staff building filtering on selected operational pages.
- Inactive-profile denial on role-protected routes and several pages.
- A checked-in feed RLS script at `sql/feed-admin-delete-policies.sql`.
- API/JSON and Supabase requests bypassed by the service-worker cache.
- Password recovery through Supabase Auth.
- Production deployment guidance requiring HTTPS.

These controls are partial. Their presence in source does not confirm matching production policies.

## Controls Requiring Live Verification

The repository does not contain a complete authoritative record of:

- RLS policies for every application table
- Database grants
- Auth provider and email configuration
- Password policy, rate limits, CAPTCHA, or MFA settings
- Active Site URL and redirect allowlist
- RPC execute grants and internal authorization
- Database triggers and audit mechanisms
- Backup retention and restore testing
- Hosting security headers
- CDN and service-worker cache headers
- Production monitoring and alerting
- Incident contacts and escalation ownership

Verify these directly in the production Supabase and hosting environments during security review.

## Authentication Model

`AuthProvider` loads the current Supabase session and listens for auth-state changes. A valid session identifies the user through `auth.uid()`/the Auth user UUID.

Authentication answers “who is the user?” It does not establish which farm data the user may access. Authorization comes from the `Users` profile, route/page checks, and RLS.

### Password requirements

The reset-password screen enforces a minimum of six characters. Supabase may enforce additional server-side policy depending on project configuration.

Client-side password checks are usability controls. Supabase Auth must enforce the actual password policy.

### Password recovery

The current recovery redirect is hardcoded to:

```text
https://ggdc-poultry-manager.cficoop.com/reset-password
```

Only approved origins should appear in the Supabase redirect allowlist. Test expired, reused, altered, and wrong-origin links.

### Session handling

- Sign-out calls `supabase.auth.signOut()`.
- Protected pages redirect unauthenticated users to `/`.
- The remember-me choice is stored locally, but Supabase client configuration controls actual session persistence.
- Shared devices require explicit sign-out.

Do not store access tokens, passwords, or service credentials in custom local-storage entries.

## Application Profile and Roles

For the route-by-route and capability-level reference, see [Role and Access Matrix](ROLE_ACCESS_MATRIX.md).

The `Users` table links an application profile to Supabase Auth through `user_uuid`.

| Role | Intended scope |
| --- | --- |
| Admin | Full operational access, restricted reports, corrections, and account administration |
| Supervisor | Approved current operations and reports without Admin-only corrections |
| Staff | Daily operations for the assigned building |

Account status is separate from the Auth account:

- `Active` profiles may receive role-protected access.
- `Inactive` profiles must be denied even if their Supabase Auth session remains valid.

Recommended invariants:

- `Users.user_uuid` is unique and non-null for every usable profile.
- Every active Auth user has exactly one current application profile.
- Staff profiles have one valid `building_id`.
- Admin and Supervisor building assignment is null unless policy defines another meaning.
- Users cannot update their own role, status, building assignment, or `user_uuid`.

`AdminOnlyRoute` currently selects the newest matching profile if duplicates exist. Database uniqueness is safer than relying on ordering.

## Route and UI Authorization

Route groups currently provide:

- Session-only protection for most operational pages.
- Admin-only protection for income-report routes.
- Active-role checks for feed and electricity routes.

Important current gap:

- `/accounts` is inside `ProtectedRoute` but not `AdminOnlyRoute`, even though account management is intended for Admin only.

Other building and harvest permissions are partly enforced inside pages. Every sensitive route must be tested through direct navigation, not only dashboard links.

Required principle:

```text
UI visibility <= route permission <= RLS permission
```

The database must never allow more access merely because the UI hides an operation.

## Supabase RLS Requirements

RLS should be enabled on every table exposed through the frontend. Policies should check both authenticated identity and the current application profile.

Conceptual active-profile check:

```text
Users.user_uuid = auth.uid()
and Users.status = 'Active'
```

Conceptual role/building rules:

| Data group | Admin | Supervisor | Staff |
| --- | --- | --- | --- |
| Buildings and cages | Full approved access | Approved management access | Assigned building read only unless a specific write is required |
| Grows, loads, daily logs, body weights | Full access including corrections | Current operational access | Assigned-building current operations |
| Feed and electricity | Full CRUD | Read/insert current records | Read/insert assigned-building current records |
| Harvest and trucks | Full CRUD | Approved current harvest operations | Deny unless explicitly approved |
| Reports | All operational data | Approved operational data | Assigned-building data only |
| Income summaries | Full CRUD | Deny | Deny |
| User profiles | Full administration | No sensitive list/update | Own minimal profile only if required |

Use table-specific policies rather than one broad authenticated policy when records carry `building_id`, `grow_id`, or a parent relation that can determine building ownership.

### Parent-derived building access

Some tables do not store `building_id` directly. Their policy must derive it safely through parent records, for example:

```text
LoadTransactions -> Load -> Grows -> Buildings
HarvestTrucks -> Harvest -> Grows/Buildings
GrowLogs -> Grows/Buildings
ElectricityConsumption -> Grows/Buildings
```

Do not trust a client-supplied building ID without confirming the referenced parent belongs to the allowed building.

### Insert and update checks

Use both row visibility and new-row validation where applicable:

- `USING` controls which existing rows can be targeted.
- `WITH CHECK` controls which inserted or updated rows are permitted.

An update policy that checks only the old row can allow a user to move a record into another building or grow. Validate the new parent identifiers as well.

### Delete policies

Deletes should be more restrictive than reads or inserts. Historical farm records should generally be corrected through approved workflows or soft-deletion/status mechanisms where traceability is required.

Admin-only UI controls do not make a permissive delete policy safe.

## Checked-In Feed Policy Script

`sql/feed-admin-delete-policies.sql` currently:

- Defines `public.is_current_user_admin()` using `Users.user_uuid`, role, and status.
- Enables RLS on `FeedsConsumption`, `FeedReceived`, `FeedTransferIn`, and `FeedTransferOut`.
- Allows all authenticated users to read and insert feed records.
- Restricts updates and deletes to Admin.

Security implications:

- The script does not restrict read or insert access by assigned building.
- An authenticated Staff user could be allowed by these policies to read all feed rows or insert a row for another building unless other active policies, grants, constraints, or parent checks prevent it.
- The function is `security definer` with `search_path = public`, which is safer than an uncontrolled search path, but ownership and execute privileges must still be reviewed.
- The script is not proof that the same policies are deployed.
- Legacy movement tables remain included even though their routes are hidden.

Treat this script as a partial policy artifact, not a complete RLS baseline.

## RPC Security

Grow bundle operations can call configurable RPC functions. For every exposed RPC:

- Require an authenticated user when appropriate.
- Verify active profile, role, and building scope inside the function or through called table policies.
- Grant execute only to intended roles.
- Fix the function `search_path` when using `security definer`.
- Fully qualify referenced tables/functions.
- Validate all parent IDs and numeric values.
- Preserve transaction atomicity.
- Return only fields required by the client.
- Record sensitive changes in an audit trail.

Do not assume table RLS automatically protects every `security definer` function.

## Account Provisioning and Lifecycle

For recurring account administration, access-change verification, and handover records, see [System Administrator Runbook](SYSTEM_ADMIN_RUNBOOK.md).

Current account creation occurs in the browser:

```text
Admin UI
  -> supabase.auth.signUp(email, password)
  -> insert Users profile with returned Auth UUID
```

Risks:

- A failure after Auth creation can leave an Auth user without a `Users` profile.
- Behavior of the current Admin session can depend on Supabase sign-up/email-confirmation configuration.
- Client-side provisioning cannot safely use service-role capabilities.
- Profile role/status enforcement depends on RLS around `Users`.

Preferred design: provision users through a trusted server-side function or administrative service that verifies the caller, creates both records, handles rollback/reconciliation, and records an audit event.

The `deleteUser` helper deletes only the application profile row, not the Supabase Auth account. Define account-deactivation and deletion policy explicitly:

- Prefer `Inactive` status for normal access removal.
- Decide who may remove the Auth identity.
- Define retention requirements for historical records.
- Prevent orphan profiles and orphan Auth users.
- Preserve actor, reason, and timestamp for administrative changes.

## Secrets and Environment Files

### Browser environment variables

All `VITE_*` values are visible in the compiled frontend. Suitable values include public URLs, public identifiers, and the Supabase anonymous/public key.

Never place these in `VITE_*`:

- Supabase service-role key
- Database password or connection string
- Email-provider secret
- Hosting API token
- Private signing key
- Backup credentials

### Current repository finding

The root `.env` file is currently tracked by Git. Its values were not inspected during this documentation review.

Required response:

1. Determine whether the tracked file contains only intentionally public frontend values.
2. Treat any actual secret committed there as exposed.
3. Rotate exposed secrets before relying on removal from the latest commit.
4. Remove sensitive values from the repository and, when required, approved Git history.
5. Use `.env.local` for local values; it is covered by the current `*.local` ignore rule.
6. Store production values in the hosting provider's protected environment configuration.
7. Review build logs, screenshots, documentation, and deployed bundles for accidental disclosure.

Adding `.env` to `.gitignore` prevents future untracked additions but does not untrack an already committed file or erase history.

## Audit and Accountability

No centralized application audit-log implementation was found in the current source.

Operational history tables preserve domain records, but they do not necessarily answer:

- Who performed the action?
- What were the previous and new values?
- Why was the change made?
- From which session/device did it occur?
- Was the attempt allowed or denied?

High-value audit events include:

- User creation, role/status/building changes, and account deactivation
- Building and cage creation/deletion
- Loading completion and reversal
- Previous-date corrections
- Feed/electricity edit and delete
- Harvest completion and reversal/correction
- Income-summary changes
- RLS, function, and schema changes
- Authentication and recovery anomalies

Audit records should be append-oriented, restricted from normal user updates/deletes, timestamped by the database, and linked to `auth.uid()`. Do not store passwords, tokens, or unnecessary sensitive payloads.

Audit failure behavior must be decided by risk: some administrative actions may need audit success to be part of the same transaction rather than non-blocking best effort.

## Input and Data Integrity

Security includes preventing cross-tenant/building references and destructive invalid totals.

- Validate numeric values as non-negative where required.
- Confirm grow, building, cage, harvest, and truck parent relationships in the database.
- Use unique constraints for one-record-per-day rules where the application assumes them.
- Prevent clients from changing immutable ownership fields without authorization.
- Use database transactions for multi-table lifecycle transitions.
- Treat remarks and names as untrusted text when rendered or exported.
- Validate file/reference URLs before exposing them to users.

React escapes normal text rendering, but generated PDFs, URLs, future HTML rendering, and external integrations still require context-aware validation.

## PWA and Cache Security

The service worker bypasses Supabase and JSON/API requests, reducing the risk of serving stale private API data from its caches.

Still verify:

- Authenticated page shells do not embed private records in static files.
- Logout clears sensitive in-memory state through normal navigation/reload behavior.
- Shared-device users sign out and close the application.
- `service-worker.js` and `index.html` are not cached immutably by the CDN.
- Only trusted HTTPS origins can register the service worker.
- Cache names are incremented when cache behavior changes.

Offline shell availability does not imply offline authorization or safe offline writes.

## Security Headers

The static host should set and test headers appropriate to the deployed integrations, including:

- Content Security Policy
- `X-Content-Type-Options: nosniff`
- Referrer Policy
- Permissions Policy
- Frame protection through CSP `frame-ancestors`
- Strict Transport Security after HTTPS deployment is stable

Build CSP from observed application requirements. Supabase endpoints, required fonts/assets, blob/data URLs used by exports, and PWA behavior may need explicit directives. Test before enforcing a restrictive production policy.

## Security Testing

Test all permissions using browser UI and direct Supabase requests made with each test user's normal session.

Required cases:

- Unauthenticated users cannot read or write operational tables.
- Inactive profiles cannot use role-protected operations.
- Staff cannot read or write another building's records.
- Staff cannot change parent IDs to move a record across buildings.
- Supervisor cannot perform Admin-only corrections, account changes, or income-summary writes.
- Non-admin direct navigation to `/accounts` and income routes is denied.
- Non-admin direct table update/delete is denied even if the UI control is hidden.
- Feed and electricity new-record policies validate the assigned building/grow.
- RPC calls reject unauthorized roles and buildings.
- Duplicate or orphan `Users` profiles do not grant access.
- Password-recovery redirects reject unapproved origins.
- Auth and application-profile lifecycle failures can be reconciled safely.

Use the Testing Guide for full release checks. Any unauthorized read or write is a release blocker.

## Security Review Checklist

- [ ] Production uses HTTPS only.
- [ ] No service-role key or private credential is present in frontend variables or bundles.
- [ ] The tracked `.env` has been reviewed and remediated if necessary.
- [ ] RLS is enabled for every frontend-accessible table.
- [ ] Select, insert, update, and delete are tested separately for each role.
- [ ] Staff building isolation is enforced by RLS, including parent-derived relationships.
- [ ] `Users.user_uuid` uniqueness and profile integrity are enforced.
- [ ] Account management and income routes are Admin-only.
- [ ] RPC execute grants and internal authorization are reviewed.
- [ ] Password-reset origin and Supabase redirect allowlist match.
- [ ] Sensitive administrative actions have an approved audit strategy.
- [ ] Backups and restoration are tested.
- [ ] Hosting security and cache headers are verified.
- [ ] Security findings and accepted risks have owners and target dates.

## Incident Response

### Immediate containment

1. Identify the affected environment, accounts, data, and time window.
2. Disable compromised accounts or set application profiles to `Inactive`.
3. Revoke or rotate exposed secrets and provider tokens.
4. Restrict affected database policies, grants, or RPC execution when safe.
5. Preserve logs and evidence before deleting or rewriting records.
6. Stop deployment or data writes if continued activity increases harm.

### Investigation

Record:

- Reporter and detection time
- Affected users, roles, buildings, tables, and routes
- Source commit and app build
- Supabase project and policy versions
- Relevant Auth, database, hosting, and deployment logs
- Unauthorized reads/writes or data-integrity impact
- Containment actions and exact times

Do not place secrets or unnecessary personal data in the incident report.

### Recovery

1. Correct the vulnerable route, page, RLS policy, RPC, or configuration.
2. Rotate affected credentials before restoring access.
3. Reconcile modified records against backups and domain history.
4. Test every role and direct data operation in staging.
5. Deploy through the normal verified release process.
6. Monitor for recurrence.
7. Update documentation, tests, and audit coverage.

### Communication

Follow organizational and legal requirements for internal escalation and any affected-party notification. Do not publish technical details that create additional exposure before containment is complete.

## Credential Rotation

When rotating a frontend Supabase key or project configuration:

1. Confirm which build variable the application actually uses.
2. Rotate or replace the key in Supabase according to provider guidance.
3. Update protected hosting environment values.
4. Rebuild because Vite embeds `VITE_*` values at build time.
5. Deploy the complete new `dist/` output.
6. Verify the deployed bundle connects to the intended project without printing key values.
7. Invalidate old deployments when they still contain usable credentials.
8. Test authentication, RLS, and core reads/writes.

If a service-role key is exposed, treat it as a high-severity incident. Remove it from every environment, rotate it immediately, and investigate database access during the exposure window.

## Security Change Procedure

For a permission, RLS, Auth, or security-sensitive change:

1. Define the threat and desired allowed/denied behavior.
2. Update the database policy or trusted server-side control first where deployment order permits.
3. Update route and page behavior for clear user feedback.
4. Test direct requests for every role and account status.
5. Test parent-ID manipulation and cross-building access.
6. Record migration, rollback, and monitoring steps.
7. Update this guide, Database Guide, Testing Guide, Architecture Guide, and Changelog.
8. Obtain security/technical review before production deployment.

Security controls should fail closed: lookup errors, missing profiles, unknown roles, or inactive status must not grant access.
