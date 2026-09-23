# Documentation Hub

This directory contains the operational and technical documentation for the GGDC Poultry Management System.

Last reviewed: 2026-09-23

## Start Here

| Audience | Read first | Continue with |
| --- | --- | --- |
| Farm Staff | [Staff Training Guide](STAFF_TRAINING_GUIDE.md) | [Farm Operations Checklist](FARM_OPERATIONS_CHECKLIST.md), [User Guide](USER_GUIDE.md), [Business Rules](BUSINESS_RULES.md) |
| Supervisor | [Staff Training Guide](STAFF_TRAINING_GUIDE.md) | [Farm Operations Checklist](FARM_OPERATIONS_CHECKLIST.md), [User Guide](USER_GUIDE.md), [Business Rules](BUSINESS_RULES.md), [Report Catalog](REPORT_CATALOG.md), [Testing Guide](TESTING_GUIDE.md) |
| Administrator | [System Administrator Runbook](SYSTEM_ADMIN_RUNBOOK.md) | [Role and Access Matrix](ROLE_ACCESS_MATRIX.md), [User Guide](USER_GUIDE.md), [Report Catalog](REPORT_CATALOG.md), [Business Rules](BUSINESS_RULES.md), [Database Guide](DATABASE_GUIDE.md) |
| Developer | [Project README](../README.md) | [Architecture Guide](ARCHITECTURE.md), [Security Guide](SECURITY_GUIDE.md), [Database Guide](DATABASE_GUIDE.md), [Business Rules](BUSINESS_RULES.md), [Changelog](../CHANGELOG.md) |
| QA / Release Tester | [Testing Guide](TESTING_GUIDE.md) | [Report Catalog](REPORT_CATALOG.md), [Business Rules](BUSINESS_RULES.md), [Deployment Guide](DEPLOYMENT_GUIDE.md) |
| Deployment Operator | [Deployment Guide](DEPLOYMENT_GUIDE.md) | [Testing Guide](TESTING_GUIDE.md), [Database Guide](DATABASE_GUIDE.md) |
| Security / RLS Reviewer | [Security Guide](SECURITY_GUIDE.md) | [Role and Access Matrix](ROLE_ACCESS_MATRIX.md), [Database Guide](DATABASE_GUIDE.md), [Architecture Guide](ARCHITECTURE.md), [Testing Guide](TESTING_GUIDE.md) |
| Business Owner | [Business Rules](BUSINESS_RULES.md) | [Report Catalog](REPORT_CATALOG.md), [User Guide](USER_GUIDE.md), [Testing Guide](TESTING_GUIDE.md) |
| Client / Project Owner | [Client Handover Guide](CLIENT_HANDOVER.md) | [Business Rules](BUSINESS_RULES.md), [Security Guide](SECURITY_GUIDE.md), [Testing Guide](TESTING_GUIDE.md), [Deployment Guide](DEPLOYMENT_GUIDE.md) |

## Document Map

### [Project README](../README.md)

Technical overview and repository entry point. It covers modules, routes, environment variables, local commands, project structure, and current operational scope.

Use it when setting up the repository or locating an application module.

### [Changelog](../CHANGELOG.md)

Unreleased changes and dated release notes for user-facing, operational, security, database, and documentation updates.

Use it when preparing a release, reviewing what changed, or identifying required operator action.

### [Architecture Guide](ARCHITECTURE.md)

Runtime structure, source responsibilities, authentication and authorization flow, Supabase data access, state ownership, reporting, PWA lifecycle, extension patterns, and known technical risks.

Use it before adding a module, route, shared calculation, data abstraction, or cross-cutting dependency.

### [Security Guide](SECURITY_GUIDE.md)

Trust boundaries, authentication, role and building isolation, expected RLS behavior, secrets, account lifecycle, audit requirements, security testing, and incident response.

Use it before changing Auth, roles, routes, user provisioning, RLS, RPC permissions, environment credentials, or sensitive data access.

### [Role and Access Matrix](ROLE_ACCESS_MATRIX.md)

Intended permissions by role, account prerequisites, route enforcement, building scope, RLS boundaries, known authorization gaps, and verification checks.

Use it when assigning a role, reviewing direct-route access, writing RLS policies, or testing authorization.

### [System Administrator Runbook](SYSTEM_ADMIN_RUNBOOK.md)

Daily, weekly, monthly, and event-driven procedures for accounts, building/grow setup, corrections, reports, releases, backups, support, incidents, and administrator handover.

Use it when operating or handing over system administration responsibilities.

### [User Guide](USER_GUIDE.md)

Step-by-step instructions for farm staff, supervisors, and administrators. It covers sign-in, daily grow activity, feed, electricity, harvest, reports, accounts, and common troubleshooting.

Use it when training users or checking the correct operational sequence.

### [Farm Operations Checklist](FARM_OPERATIONS_CHECKLIST.md)

Printable daily, end-of-shift, harvest, grow-closeout, exception-handover, and supervisor sign-off checklists.

Use it during farm operations after users have been trained with the User Guide.

### [Staff Training Guide](STAFF_TRAINING_GUIDE.md)

Role-based onboarding paths, controlled practical exercises, competency assessment, production-access approval, transfer, offboarding, and refresher training.

Use it before granting or expanding production access.

### [Client Handover Guide](CLIENT_HANDOVER.md)

Formal delivery record for system scope, asset ownership, environment references, security, backups, documentation, training, UAT, limitations, support terms, and acceptance.

Use it when transferring production responsibility or completing client acceptance.

### [Business Rules](BUSINESS_RULES.md)

Definitions, lifecycle rules, formulas, statuses, permissions, data invariants, and reconciliation procedures.

Use it when a total is questioned, a workflow rule changes, or implementation behavior must be compared with approved farm policy.

### [Report Catalog](REPORT_CATALOG.md)

Current report routes, access boundaries, filters, source tables, summary calculations, exports, identifier conventions, and reconciliation warnings.

Use it when validating a report, investigating a disputed total, or changing report behavior.

### [Database Guide](DATABASE_GUIDE.md)

Supabase tables, application-used columns, relationships, RPC functions, integrity recommendations, and schema-change checks.

Use it before modifying tables, columns, constraints, indexes, functions, or RLS policies.

### [Testing Guide](TESTING_GUIDE.md)

Automated validation commands, role-based acceptance tests, module regressions, data reconciliation, PWA checks, and release sign-off.

Use it before every release and after changes to workflows, permissions, calculations, routes, or database behavior.

### [Deployment Guide](DEPLOYMENT_GUIDE.md)

Environment setup, production builds, Supabase preparation, static hosting, SPA fallback, PWA updates, verification, backup, rollback, and deployment troubleshooting.

Use it when preparing, deploying, verifying, or rolling back a release.

## Recommended Reading Paths

### New farm user

```text
Staff Training Guide -> Farm Operations Checklist -> User Guide -> Business Rules terms and daily formulas
```

The trainer should demonstrate the user's assigned building and role-specific restrictions in a non-production or controlled environment.

### New developer

```text
Project README -> Business Rules -> Database Guide -> Testing Guide
```

Read the relevant feature section before changing calculations or data access. Verify the live Supabase schema because the repository does not contain an authoritative migration history.

### Production release

```text
Deployment Guide -> Testing Guide -> Release sign-off
```

Keep the deployed source commit, app build number, hosting deployment identifier, database migration/version, and rollback reference together.

### Client handover

```text
Client Handover Guide -> Testing Guide -> Staff Training Guide -> System Administrator Runbook
```

Complete the handover using the exact accepted commit, build, production environment, backup, and deployment references.

### Business-rule change

```text
Business Rules -> Database Guide -> User Guide -> Testing Guide -> Deployment Guide
```

Confirm whether the new rule applies only to future records or requires an approved historical-data migration.

### Incident investigation

```text
User Guide troubleshooting -> Business Rules reconciliation -> Database Guide -> Deployment Guide rollback
```

Preserve evidence before correcting records. Record the affected role, building, grow, date, source values, displayed values, and deployment version.

## Source of Truth

Use this order when documentation and behavior disagree:

1. Approved business policy defines what the system should do.
2. The live Supabase schema, RLS policies, functions, and stored data define production database behavior.
3. The deployed source commit defines application behavior.
4. This documentation explains the intended and observed behavior.

A discrepancy is not resolved merely by changing documentation. Determine whether the policy, database, application, or document is incorrect, then update the appropriate sources together.

Do not treat UI-hidden controls as security enforcement. Route guards and Supabase RLS must enforce authorization.

## Ownership

Ownership is assigned by responsibility rather than a named individual so the documents remain maintainable when staff changes.

| Document | Primary owner | Required reviewers |
| --- | --- | --- |
| Project README | Development | Deployment operator when environment/build instructions change |
| Changelog | Release owner | Development, QA, and deployment operator |
| Architecture Guide | Development | Security/RLS owner, QA, and deployment operator |
| Security Guide | Security / RLS owner | Development, database administrator, QA, and deployment operator |
| Role and Access Matrix | Business owner / Security or RLS owner | Development, Operations, and QA |
| System Administrator Runbook | System administrator / Operations | Business owner, Security, Development, and deployment operator |
| User Guide | Operations / Training | Business owner and Development |
| Farm Operations Checklist | Operations / Training | Business owner, supervisors, and Development |
| Staff Training Guide | Operations / Training | Business owner, supervisors, System administrator, and Security |
| Client Handover Guide | Project owner / Business owner | System administrator, Security, Development, QA, and deployment operator |
| Business Rules | Business owner | Operations, Development, and QA |
| Report Catalog | Business owner / Development | Operations, QA, and Security or RLS owner |
| Database Guide | Development / Database administrator | Security or RLS owner and QA |
| Testing Guide | QA / Release owner | Operations and Development |
| Deployment Guide | Deployment / Operations | Development and database administrator |

The primary owner coordinates updates. Reviewers confirm that terminology, behavior, security, and validation remain consistent.

## Update Triggers

### Update the Project README when

- A module, route, dependency, environment variable, or setup command changes.
- The visible feed workflow or another feature scope changes.
- Project structure or build behavior changes.

### Update the Changelog when

- A user-facing, operational, security, database, or documentation change is completed.
- A release is deployed and its source commit, app build, and migration status are known.
- A known issue or required operator action changes.

### Update the Architecture Guide when

- Application startup, routing, guards, state ownership, data access, module boundaries, reporting, PWA behavior, or build flow changes.
- A new shared service, dependency, test layer, migration system, or security boundary is introduced.
- A listed architectural risk is resolved or a new cross-cutting risk is identified.

### Update the Security Guide when

- Authentication, roles, account status, building isolation, RLS, RPC permissions, secrets, audit behavior, or security headers change.
- A security review confirms or disproves a documented risk.
- An incident, credential rotation, or authorization defect reveals a missing control or test.

### Update the Role and Access Matrix when

- A role, account status, building assignment, route guard, page permission, or RLS policy changes.
- A role gains or loses a module, mutation, report, export, or account-management capability.
- Current enforcement is found to differ from approved business access.

### Update the System Administrator Runbook when

- Account, setup, correction, report approval, backup, deployment, incident, or handover procedures change.
- Administration ownership, review frequency, evidence, or escalation requirements change.
- A production issue reveals a missing administrative control.

### Update the User Guide when

- A screen label, navigation path, form field, user workflow, or role-visible action changes.
- A new operator task or common support issue is introduced.
- Screenshots or training instructions become outdated.

### Update the Farm Operations Checklist when

- A daily, harvest, closeout, correction, escalation, or supervisor review step changes.
- A required field, status, report, role permission, or sign-off requirement changes.
- Operations approves a different shift or handover procedure.

### Update the Staff Training Guide when

- A role, workflow, field, formula, permission, assessment, or access-approval requirement changes.
- A recurring user error or incident reveals a missing exercise or competency check.
- Transfer, offboarding, refresher, or training-record requirements change.

### Update the Client Handover Guide when

- Delivery scope, environment ownership, backup, training, UAT, support, or acceptance requirements change.
- A known limitation, accepted risk, open issue, or transferred responsibility changes.
- A handover review identifies missing evidence, assets, owners, or sign-off.

### Update Business Rules when

- A formula, status, lifecycle transition, unit, feed code, permission, or reconciliation rule changes.
- The business approves a different interpretation of historical records.
- A calculation defect is fixed in a way that changes expected results.

### Update the Report Catalog when

- A report route, tile, role guard, filter, source, formula, identifier, or export changes.
- A report begins using a different stored summary or operational record.
- A reconciliation issue reveals an undocumented difference between reports.

### Update the Database Guide when

- A table, column, relationship, constraint, index, RPC function, trigger, or RLS policy changes.
- A table/column environment override is added or removed.
- A legacy table becomes active or is retired.

### Update the Testing Guide when

- A workflow, role restriction, calculation, route, browser requirement, or release risk changes.
- A production defect reveals a missing regression case.
- Automated tests or test scripts are added to the repository.

### Update the Deployment Guide when

- Hosting, domain, Supabase project, password-reset URL, cache strategy, environment handling, or build commands change.
- Backup, rollback, monitoring, or release ownership changes.
- The application is deployed under a subpath instead of the domain root.

## Documentation Change Checklist

Before considering a documentation update complete:

- [ ] The instructions match the current source code and visible UI.
- [ ] Business formulas match approved policy and current implementation.
- [ ] Table and column names match application queries or are clearly marked for live-schema verification.
- [ ] Role statements distinguish intended access from UI-only restrictions.
- [ ] Commands are safe and use the repository's actual scripts.
- [ ] Relative links resolve from the document containing them.
- [ ] Related guides are updated when the same change affects multiple audiences.
- [ ] No credentials, private keys, personal data, or production secrets are included.
- [ ] `git diff --check` passes.
- [ ] Validation claims state exactly what was and was not tested.
- [ ] The review date is updated when the full documentation set is revalidated.

## Writing Conventions

- Use the exact on-screen label in bold when describing a control, such as **Daily Feed Usage**.
- Use backticks for routes, table names, columns, environment variables, statuses, and code values.
- State units next to numeric values and formulas.
- Use `Admin`, `Supervisor`, and `Staff` exactly as stored by the application.
- Use building-local labels such as `Grow #1` for users; use database IDs only for technical diagnostics.
- Mark recommendations separately from behavior already implemented.
- Do not invent schema constraints, RLS policies, or operational approvals that have not been verified.
- Keep examples free of real credentials and personal information.

## Documentation Review Record

Use this template for a full documentation review:

```text
Review date:
Reviewer(s):
Source commit:
App version/build:
Supabase environment checked:
Documents reviewed:
UI workflows verified:
Database behavior verified:
Links checked:
Open documentation gaps:
Related code defects found:
Result: CURRENT / UPDATE REQUIRED
```

Documentation review can reveal code or security defects, but documentation changes do not fix those defects. Record them separately and track them through the project's normal development process.
