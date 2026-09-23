# Changelog

This file records notable user-facing, operational, security, database, and documentation changes to the GGDC Poultry Management System.

Historical releases are not backfilled because verified release notes are not available. Add confirmed release entries from this point forward.

## Unreleased

### Added

- Replaced the starter project README with system documentation covering modules, routes, Supabase configuration, local development, and build behavior.
- Added an operator User Guide for daily farm workflows, account roles, reports, and troubleshooting.
- Added a Database Guide describing application-used Supabase tables, columns, relationships, RPCs, and schema-change checks.
- Added a Deployment Guide covering production builds, static hosting, PWA updates, verification, backups, and rollback.
- Added a Testing Guide with role-based acceptance tests, module regressions, reconciliation, and release sign-off.
- Added a Business Rules reference for grow lifecycle, poultry terms, calculations, statuses, permissions, and data invariants.
- Added a Documentation Hub with audience-based navigation, ownership, update triggers, and review standards.
- Added an Architecture Guide covering runtime structure, module boundaries, data flow, PWA behavior, extension patterns, and known technical risks.
- Added a Security Guide covering trust boundaries, Auth and RLS expectations, account lifecycle, secrets, audit requirements, security testing, and incident response.
- Added a Report Catalog covering report access, filters, source records, calculations, exports, identifier differences, and reconciliation procedures.
- Added a Role and Access Matrix covering intended permissions, route enforcement, building scope, known authorization gaps, and required RLS verification.
- Added a Farm Operations Checklist for daily recording, harvest, grow closeout, correction handover, escalation, and supervisor sign-off.
- Added a System Administrator Runbook for account lifecycle, building and grow setup, corrections, report approval, release coordination, backups, support, incidents, and handover.
- Added a Staff Training and Onboarding Guide with role-based exercises, competency assessment, production-access approval, transfer, offboarding, and refresher training.
- Added a Client Handover and Acceptance Guide covering delivered scope, environment ownership, security, backups, training, UAT, known limitations, support terms, and sign-off.

## Release Entry Format

When preparing a release, move completed items from **Unreleased** into a dated release section:

```markdown
## Version X.Y.Z - YYYY-MM-DD

App build: `1.0.0+build.N`
Source commit: `commit-hash`
Database migration: `migration-id` or `None`

### Added

- New features, modules, reports, or documentation.

### Changed

- Changes to existing workflows, calculations, permissions, or UI behavior.

### Fixed

- Defects corrected, including the affected module and user impact.

### Security

- Authentication, authorization, RLS, credential, or data-exposure changes.

### Database

- Tables, columns, constraints, indexes, RPCs, migrations, or data corrections.

### Deprecated

- Features or interfaces that remain available but are planned for removal.

### Removed

- Features, routes, tables, or compatibility behavior removed from the system.

### Known Issues

- Confirmed unresolved issues and approved workarounds.
```

Omit empty categories from a released section. Keep **Security** and **Database** entries explicit instead of hiding them under general changes.

## Writing Rules

- Describe the user or operational impact, not only the filename changed.
- Use one bullet per independently understandable change.
- Name the affected module when the scope is not obvious.
- Link an issue, migration, or supporting document when available.
- Do not include credentials, personal information, or sensitive incident details.
- Do not label a change as released until its deployment is confirmed.
- Record breaking behavior and required operator action clearly.
- For calculation changes, state whether historical records are recalculated.
- For database changes, record the migration identifier and rollback requirement.
- For security fixes, disclose enough for maintainers without publishing exploitable secrets.

## Release Checklist

Before creating a dated changelog entry:

- [ ] All included changes are deployed or approved for the same release.
- [ ] The source commit and application build number are recorded.
- [ ] Database migrations and compatibility requirements are recorded.
- [ ] User-visible workflow and permission changes are documented.
- [ ] Related guides are updated.
- [ ] Testing and release sign-off are complete.
- [ ] Known issues and approved workarounds are listed.
- [ ] Rollback information exists in the deployment record.
- [ ] Unreleased entries not included in the release remain under **Unreleased**.
