# System Administrator Runbook

This runbook organizes recurring administration of the GGDC Poultry Management System. It covers application accounts, building and grow setup, correction requests, report review, releases, backups, and incident escalation.

Last reviewed: 2026-09-23

## Scope and Authority

The System Administrator coordinates operational administration but must not bypass approved business, database, security, or deployment controls.

| Responsibility | Typical owner | Administrator role |
| --- | --- | --- |
| User role, status, and building assignment | Application Admin / Business Owner | Apply approved access changes and verify them |
| Building and grow setup | Operations / Supervisor | Configure approved records and verify relationships |
| Historical data corrections | Business Owner / authorized Admin | Preserve evidence, apply supported correction, reconcile results |
| RLS and schema changes | Database / Security owner | Coordinate, review, and record the approved change |
| Application release | Development / Deployment operator | Confirm readiness, deployment record, and post-release checks |
| Backup and recovery | Database / Deployment owner | Confirm backup status and coordinate tested recovery |
| Security incident response | Security owner | Contain access, preserve evidence, and escalate immediately |

Do not use browser-visible credentials for privileged database administration. Never place a Supabase service-role key in the application, a `VITE_*` variable, screenshots, tickets, or this documentation.

## Administrator Quick Start

Before performing administrative work:

- [ ] Sign in with your own active Admin account.
- [ ] Confirm the production, staging, or test environment before changing data.
- [ ] Confirm the requested action, approver, building, grow, and effective date.
- [ ] Preserve screenshots, source records, or request references needed for verification.
- [ ] Confirm the action is supported by the application and allowed by [Role and Access Matrix](ROLE_ACCESS_MATRIX.md).
- [ ] For database, release, or bulk-data work, confirm a current backup and rollback owner.
- [ ] Record what changed, who approved it, who performed it, and who verified it.

## Routine Schedule

### Daily

- [ ] Review account and access requests awaiting approval.
- [ ] Review correction requests from farm staff and supervisors.
- [ ] Check unresolved missing grow, feed, electricity, or harvest records.
- [ ] Confirm critical reports open for the intended roles and buildings.
- [ ] Escalate cross-building visibility, unauthorized corrections, or suspicious account activity immediately.
- [ ] Confirm operators have completed required handover notes in the [Farm Operations Checklist](FARM_OPERATIONS_CHECKLIST.md).

### Weekly

- [ ] Review active user profiles for correct role, status, and Staff building assignment.
- [ ] Review active grows for duplicate or contradictory lifecycle states.
- [ ] Review pending feed days and incomplete electricity statuses.
- [ ] Review harvested grows for unresolved bird, truck, or reduction differences.
- [ ] Confirm recent corrections include evidence and post-correction reconciliation.
- [ ] Review current application build and outstanding release or support issues.

### Monthly

- [ ] Ask the database owner to confirm backup health and the latest successful backup date.
- [ ] Confirm a recovery test has been performed according to the approved schedule.
- [ ] Review inactive, departed, transferred, and privileged accounts.
- [ ] Review Staff building assignments against current staffing.
- [ ] Review Supabase Auth redirect URLs and approved production origins.
- [ ] Review RLS, schema, and deployment changes completed during the month.
- [ ] Reconcile representative grows across load, daily activity, feed, electricity, harvest, and reports.
- [ ] Review documentation changes required by new screens, rules, permissions, or incidents.
- [ ] Record review date, owner, findings, actions, and due dates.

## User Account Administration

Account management is intended for Admin only. The `/accounts` route currently has only a session-level route guard, so live RLS must prevent unauthorized profile access and mutation.

Before granting or expanding production access, confirm the user's role-specific competency and approval record in the [Staff Training Guide](STAFF_TRAINING_GUIDE.md).

### Create an account

1. Obtain approved full name, email, role, status, and Staff building assignment.
2. Confirm the email is not already linked to an Auth user or application profile.
3. Open **Accounts** and create the user.
4. For `Staff`, select exactly one valid building assignment.
5. For `Admin` or `Supervisor`, leave building assignment empty unless approved policy says otherwise.
6. Confirm both the Supabase Auth user and matching `Users.user_uuid` profile exist.
7. Test sign-in and intended access without sharing the user's password.
8. Confirm prohibited routes and another building's data remain denied.
9. Record the approver, administrator, role, building, and verification result.

### Change a role or building assignment

1. Obtain approval and an effective date.
2. Record the previous role, status, and building assignment.
3. Apply the new values in **Accounts**.
4. Have the user sign out and sign in again.
5. Verify newly allowed access and verify removed access directly.
6. Confirm RLS rejects stale or manually altered requests outside the new scope.
7. Record completion and reviewer evidence.

### Deactivate an account

1. Confirm the identity and approval; do not rely on display name alone.
2. Set the application profile status to `Inactive`.
3. Confirm role-protected routes deny the account.
4. Ask the Auth/Security owner to revoke sessions or disable Auth access when required.
5. Reassign pending operational work without transferring account credentials.
6. Preserve the profile and audit evidence according to retention policy.

An `Inactive` application profile does not automatically prove that every existing Auth session or permissive database policy is blocked. Verify the result.

### Delete or duplicate profiles

Do not delete a `Users` profile as a routine deactivation method. Profile deletion may leave an orphaned Supabase Auth account and remove operational evidence.

When duplicate profiles reference one Auth UUID:

1. Stop role or access changes for the affected user.
2. Identify the authoritative profile with the Business and Security owners.
3. Export or preserve both records and related evidence.
4. Correct the data through an approved database procedure.
5. Add or verify the intended uniqueness constraint only after conflicts are resolved.
6. Retest every role and building boundary for the account.

## Building Administration

### Create a building

1. Obtain the approved building name and expected cage/sub-building structure.
2. Confirm no existing building represents the same physical location.
3. Use the dashboard add-building workflow as Admin or authorized Supervisor.
4. Confirm the building and expected child records were created once.
5. Confirm the new building appears in selectors and reports where intended.
6. Confirm Staff users cannot access it until explicitly assigned.
7. Assign approved Staff profiles and test building isolation.

Do not rename, merge, or remove a production building without reviewing child grows, cages, users, and historical reports.

### Start a grow

1. Confirm the building has no conflicting active grow.
2. Confirm loading date, initial bird total, cages, and source documentation.
3. Create and complete the grow-loading workflow with an authorized operator.
4. Confirm the grow status and building-local sequence label.
5. Confirm day `0` records and electricity baseline requirements.
6. Confirm daily grow, feed, electricity, and reports select the new grow.
7. Preserve the loading reference and reviewer sign-off.

### Close a grow

Use the grow closeout section in [Farm Operations Checklist](FARM_OPERATIONS_CHECKLIST.md). Do not manually force `Harvested` status merely to remove a grow from active screens. Reconcile load, reductions, completed harvest trucks, harvest reductions, feed, electricity, and reports first.

## Data Correction Requests

Only authorized Admin users should perform supported historical corrections.

### Required request information

```text
Request ID:
Requested by / date:
Approved by / date:
Environment:
Building and grow:
Module and record ID:
Operational date or grow day:
Current value:
Expected value:
Reason and source evidence:
Dependent totals to verify:
Correction owner:
Independent reviewer:
```

### Correction procedure

1. Confirm the request refers to the correct environment, building, grow, date, and record.
2. Preserve the original displayed value and source evidence.
3. Check whether the correction is supported in the application.
4. Identify dependent values before editing: later balances, cumulative feed, electricity differences, harvest totals, statuses, and PDFs.
5. Apply the smallest approved correction; do not create an offsetting duplicate.
6. Reload the source screen and verify the corrected row.
7. Reconcile dependent operational screens and reports.
8. Generate replacement PDFs only after the corrected data is confirmed.
9. Record before/after values, performer, reviewer, time, and outcome.
10. Escalate unsupported or bulk corrections to the database owner with a tested backup and migration plan.

See [Business Rules](BUSINESS_RULES.md) for formulas and [Report Catalog](REPORT_CATALOG.md) for report-source differences.

## Report Administration

Before distributing a final report:

- [ ] Confirm the user, role, building, grow, status, and date filters.
- [ ] Confirm whether the grow label is a building-local sequence or database ID.
- [ ] Compare report rows with source records before trusting summary cards.
- [ ] Distinguish loaded birds from actual animals harvested.
- [ ] Distinguish saved daily electricity kWh from complete grow-cycle meter difference.
- [ ] Compare daily feed totals with `FeedUsageSummary` when a summary is used.
- [ ] Reconcile manually stored Income Summary values with operational reports.
- [ ] Confirm the PDF contains no unauthorized building or account data.
- [ ] Record the generation date, application build, filters, preparer, and reviewer.

Do not treat a previously generated PDF as current after source records change.

## Release Administration

The administrator coordinates business readiness; Development and the Deployment operator own the technical release procedure.

### Before release

- [ ] Confirm approved scope and source commit.
- [ ] Confirm business-rule, role, database, and documentation impacts are reviewed.
- [ ] Confirm automated and manual test results in [Testing Guide](TESTING_GUIDE.md).
- [ ] Confirm the target Supabase and hosting environments.
- [ ] Confirm backup and rollback references for schema or data changes.
- [ ] Confirm operator communications and maintenance timing.

### After release

- [ ] Confirm the displayed application build.
- [ ] Test active and inactive account behavior.
- [ ] Test Admin, Supervisor, and Staff building scope.
- [ ] Open nested routes directly and verify authorization.
- [ ] Perform one approved read and write in a controlled record.
- [ ] Verify key reports and PDF generation.
- [ ] Confirm password reset and PWA update behavior when affected.
- [ ] Record deployment ID, commit, build, database change, operator, verification, and rollback reference.

Follow [Deployment Guide](DEPLOYMENT_GUIDE.md) for commands, hosting requirements, cache behavior, rollback, and troubleshooting.

## Backup and Recovery Coordination

Frontend files are not a database backup.

The administrator should maintain a record of:

- Latest confirmed database backup or approved export.
- Backup owner and storage location reference, without embedding credentials.
- Last successful restore test and result.
- Current production deployment ID and source commit.
- Last known-good deployment and rollback reference.
- Database migrations or manual data corrections since the backup.
- Recovery decision owner and communication contacts.

Never test a restore by overwriting production. Recovery must use an approved non-production environment unless an authorized incident procedure requires production restoration.

## Security and Access Incidents

Examples include cross-building data visibility, unauthorized corrections, exposed credentials, unexpected role access, suspicious account creation, or report leakage.

1. Stop the affected workflow and preserve evidence.
2. Record user, role, building, route, time, app build, and affected records.
3. Notify the Security owner and Business Owner.
4. Restrict or deactivate affected access when authorized.
5. Do not delete logs, profiles, records, or deployments that may be evidence.
6. Determine whether UI, route guard, RLS, RPC, credentials, or data relationships failed.
7. Correct the authoritative control and test every role, building, and direct request.
8. Reconcile changed records and regenerate affected reports.
9. Record recovery, communication, and prevention actions.

Follow the full process in [Security Guide](SECURITY_GUIDE.md). Treat exposure of a service-role key as a high-severity incident requiring immediate rotation and investigation.

## Support Triage

| Reported problem | First checks | Escalate to |
| --- | --- | --- |
| Cannot sign in | Email, password reset, Auth user, account status | Auth/Security owner |
| Page redirects or cannot open | Role, status, route guard, direct-route expectation | Application Admin / Development |
| Building or grow missing | Staff assignment, grow status, filters, RLS | Application Admin / Database owner |
| Saved data not visible | Environment, building/grow/date, reload, source row, RLS | Development / Database owner |
| Wrong feed total | Daily rows, grow/day uniqueness, summary source | Operations / Development |
| Wrong electricity total | Day `0`, final reading, reset/replacement, saved daily kWh | Operations / Development |
| Wrong harvest balance | Load total, trucks, reductions, grow status | Operations / Business Owner |
| Report differs from screen | Filters, source table, identifier type, generation time | Report owner / Development |
| Users see old version | Build number, service worker, deployment artifact, cache | Deployment operator |
| Cross-building or unauthorized data | Preserve evidence and restrict access | Security owner immediately |

## Administrator Handover

For a formal transfer of production ownership to the client, complete the [Client Handover Guide](CLIENT_HANDOVER.md) in addition to the operational handover below.

```text
Handover date/time:
Outgoing administrator:
Incoming administrator:
Current production build:
Current deployment ID:
Supabase environment reference:
Last confirmed backup:
Last restore test:
Open account requests:
Open correction requests:
Open incidents:
Pending releases or schema changes:
Known report discrepancies:
Required actions and due dates:
Supporting ticket/document references:
```

Do not include passwords, private keys, recovery codes, or personal data beyond what is operationally necessary.

## Administrative Change Record

```text
Change ID:
Date/time:
Environment:
Requested by:
Approved by:
Performed by:
Change type: Account / Building / Grow / Correction / Release / Security / Other
Affected building/grow/user/record:
Before state:
After state:
Evidence/reference:
Verification performed:
Verified by:
Rollback or recovery reference:
Result: Completed / Reverted / Escalated
```

## Update This Runbook When

- Account creation, status, roles, building assignment, or provisioning behavior changes.
- Building/grow setup or correction workflows change.
- Report approval, backup, deployment, incident, or handover procedures change.
- A production issue reveals a missing administrative control or verification step.

Operational changes should also update the User Guide, Farm Operations Checklist, Role and Access Matrix, Business Rules, Testing Guide, or Deployment Guide when those documents are affected.
