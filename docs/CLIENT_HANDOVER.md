# Client Handover and Acceptance Guide

Use this document to transfer the GGDC Poultry Management System, its operational responsibilities, and its supporting records to the client. Complete it for the actual production environment and retain the signed version with the release records.

Last reviewed: 2026-09-23

## Document Control

```text
Handover record ID:
Project/client:
Prepared by:
Preparation date:
Handover meeting date:
Source commit:
Application version/build:
Production deployment ID:
Supabase environment reference:
Document version:
Status: Draft / Ready for review / Accepted / Accepted with conditions
```

Do not place passwords, private keys, recovery codes, service-role keys, or full credential values in this document. Record only the approved password-manager vault/item reference and transfer credentials through the agreed secure channel.

## Handover Parties

| Responsibility | Organization/person | Contact reference | Confirmed |
| --- | --- | --- | --- |
| Client Business Owner |  |  |  |
| Client System Administrator |  |  |  |
| Farm Operations Owner |  |  |  |
| Security / RLS Owner |  |  |  |
| Database / Supabase Owner |  |  |  |
| Hosting / Deployment Owner |  |  |  |
| Development Support |  |  |  |
| Training Owner |  |  |  |
| Incident Escalation Contact |  |  |  |

Every operational responsibility must have an owner. Do not accept a handover with critical access or recovery duties assigned only to an unavailable individual.

## Delivered System Scope

Confirm the modules included in the accepted release.

| Module | Delivered | Client verified | Notes/evidence |
| --- | --- | --- | --- |
| Authentication and password recovery |  |  |  |
| Role, status, and Staff building assignment |  |  |  |
| Dashboard and navigation |  |  |  |
| Building and cage/sub-building setup |  |  |  |
| Grow loading and lifecycle |  |  |  |
| Daily grow activity and body weight |  |  |  |
| Daily feed usage |  |  |  |
| Daily and grow-cycle electricity |  |  |  |
| Harvest and truck workflow |  |  |  |
| Active and harvested grow reports |  |  |  |
| Daily Feed and Electricity reports |  |  |  |
| Income Summaries |  |  |  |
| PDF generation |  |  |  |
| User account administration |  |  |  |
| Settings and PWA installation/update |  |  |  |

The current visible feed workflow is daily-feed-only. Feed Received, Transfer In, and Transfer Out are not part of the routed operator workflow; legacy section URLs redirect to daily feed.

## Environment and Asset Inventory

Record identifiers and ownership, not secret values.

| Asset | Production reference | Owner | Access transferred | Recovery reference |
| --- | --- | --- | --- | --- |
| Source-code repository |  |  |  |  |
| Production domain |  |  |  |  |
| DNS account |  |  |  |  |
| Static hosting project |  |  |  |  |
| Supabase organization/project |  |  |  |  |
| Supabase Auth configuration |  |  |  |  |
| Approved email account/provider |  |  |  |  |
| Monitoring/log access |  |  |  |  |
| Password-manager vault/items |  |  |  |  |
| Backup/export storage |  |  |  |  |
| Last known-good deployment |  |  |  |  |
| Domain/hosting billing account |  |  |  |  |

### Production configuration record

```text
Production URL:
Hosting provider/project:
Deployment ID and time:
Source commit:
App build shown in UI:
Supabase project name/reference:
Supabase region:
Password-reset URL:
PWA deployment base: origin root / other approved configuration
Environment-variable record location:
Last known-good deployment:
Rollback owner:
```

Do not print the values of `VITE_SUPABASE_URL`, public keys, or any other credential-like configuration in a broadly shared handover copy. Confirm presence and ownership through protected provider settings.

## Account and Security Handover

- [ ] At least two approved client representatives can access the required administrative provider accounts, where policy allows.
- [ ] Individual application Admin accounts exist; no shared Admin credential is used.
- [ ] Staff accounts have the correct building assignments.
- [ ] Inactive and departed users have been reviewed.
- [ ] Production Supabase RLS policies have been reviewed and evidence is attached.
- [ ] Staff cross-building `SELECT`, `INSERT`, `UPDATE`, and `DELETE` tests have been completed.
- [ ] Supervisor and Staff are denied Admin-only corrections and income-summary access.
- [ ] Non-admin direct access to `/accounts` has been tested and denied by the authoritative security boundary.
- [ ] Password reset returns to the production domain.
- [ ] Auth redirect URLs contain only approved origins.
- [ ] Credential rotation ownership and incident contacts are documented.
- [ ] No service-role key is exposed in browser code or frontend environment variables.

Use [Security Guide](SECURITY_GUIDE.md) and [Role and Access Matrix](ROLE_ACCESS_MATRIX.md) for the full authorization review.

## Data and Backup Handover

```text
Production data owner:
Latest confirmed backup/export date:
Backup type and provider reference:
Backup retention policy reference:
Backup storage owner:
Last restore-test date:
Restore-test environment:
Restore-test result/evidence:
Recovery decision owner:
Recovery time objective, if approved:
Recovery point objective, if approved:
```

- [ ] The client understands that deployed frontend files are not a database backup.
- [ ] The current schema, functions, triggers, constraints, indexes, and RLS policies have been inventoried from the live Supabase project.
- [ ] Manual data corrections or migrations after the latest backup are recorded.
- [ ] A last known-good frontend deployment and rollback reference are retained.
- [ ] Recovery has been tested outside production or an accepted recovery-test gap is recorded.
- [ ] The client knows who may authorize restoration or rollback.

## Documentation Delivered

- [ ] [Project README](../README.md)
- [ ] [Documentation Hub](README.md)
- [ ] [User Guide](USER_GUIDE.md)
- [ ] [Farm Operations Checklist](FARM_OPERATIONS_CHECKLIST.md)
- [ ] [Staff Training Guide](STAFF_TRAINING_GUIDE.md)
- [ ] [System Administrator Runbook](SYSTEM_ADMIN_RUNBOOK.md)
- [ ] [Role and Access Matrix](ROLE_ACCESS_MATRIX.md)
- [ ] [Business Rules](BUSINESS_RULES.md)
- [ ] [Report Catalog](REPORT_CATALOG.md)
- [ ] [Database Guide](DATABASE_GUIDE.md)
- [ ] [Architecture Guide](ARCHITECTURE.md)
- [ ] [Security Guide](SECURITY_GUIDE.md)
- [ ] [Testing Guide](TESTING_GUIDE.md)
- [ ] [Deployment Guide](DEPLOYMENT_GUIDE.md)
- [ ] [Changelog](../CHANGELOG.md)

Record the source commit or document version delivered so later edits are distinguishable from the accepted package.

## Training Handover

| Training group | Required participants | Completed date | Trainer | Evidence/reference | Follow-up due |
| --- | --- | --- | --- | --- | --- |
| Farm Staff |  |  |  |  |  |
| Supervisors |  |  |  |  |  |
| Application Admins |  |  |  |  |  |
| Deployment operators |  |  |  |  |  |
| Security / database owners |  |  |  |  |  |

- [ ] Role-specific competency assessments are complete.
- [ ] Production access approvals are signed.
- [ ] Transfer, offboarding, and refresher processes are understood.
- [ ] At least one client administrator completed an account lifecycle exercise.
- [ ] At least one client operator completed a grow reconciliation and report review.
- [ ] At least one responsible operator understands backup confirmation and rollback escalation.

Training attendance alone is not production-access approval. Use [Staff Training Guide](STAFF_TRAINING_GUIDE.md) for competency records.

## User Acceptance Testing

Complete acceptance testing against the release candidate or deployed production build using approved controlled records.

| Acceptance area | Expected evidence | Result | Issue/reference |
| --- | --- | --- | --- |
| Active login, inactive denial, sign-out | Screenshots/test record |  |  |
| Admin, Supervisor, Staff role boundaries | Role test record |  |  |
| Staff building isolation | Direct route and database-request evidence |  |  |
| Building and grow loading | Created test structure and totals |  |  |
| Daily grow activity | Saved/reloaded values and history |  |  |
| Daily feed usage | One row per grow/day and matching report |  |  |
| Electricity | Daily readings and all completeness statuses |  |  |
| Harvest | Truck totals, reductions, remaining birds, closeout |  |  |
| Reports | Filters, totals, identifiers, and PDF output |  |  |
| Income Summary | Admin-only access and source reconciliation |  |  |
| Account management | Approved lifecycle and denied non-admin access |  |  |
| Mobile/PWA | Supported viewport, install/update, online data |  |  |
| Backup/rollback readiness | References and responsible owner |  |  |

Allowed results are `Pass`, `Fail`, `Accepted with condition`, or `Not applicable`. Every non-pass result needs an owner, target date, and acceptance decision.

Use [Testing Guide](TESTING_GUIDE.md) for the detailed test procedures and sign-off record.

## Known Limitations and Risks

Review and update this list against the accepted source commit and live environment.

| Item | Current implication | Acceptance/mitigation | Owner and target date |
| --- | --- | --- | --- |
| Authorization is distributed across route guards, page checks, and RLS | Direct-route and database-policy testing remains mandatory |  |  |
| `/accounts` is session-route-protected rather than Admin-route-guarded | RLS must prevent non-admin reads/writes; successful access is a blocker |  |  |
| Repository lacks an authoritative full migration/RLS history | Live Supabase schema and policies must be inventoried before changes |  |  |
| Automated unit/end-to-end coverage is not currently included | Manual acceptance and regression testing carry more risk |  |  |
| Password-reset origin is currently tied to the configured production flow | Multi-domain deployment requires review and rebuild |  |  |
| PWA behavior assumes origin-root hosting | Subpath hosting requires application/service-worker changes |  |  |
| Account creation spans Supabase Auth and `Users` profile data | Partial failure and duplicate/orphan records require review |  |  |
| Some summaries are calculated client-side or stored separately | Reports can drift until source records are reconciled |  |  |
| Grow identifiers are not displayed consistently in every report | Compare building-local labels and database IDs carefully |  |  |
| Income Summaries are manually stored values | They do not automatically update with operational records |  |  |
| Income Summary tile is hidden from the reports menu | Authorized Admin uses the direct route until behavior changes |  |  |
| Feed movement screens are outside current visible scope | Daily feed usage is the accepted active workflow |  |  |

An accepted limitation is not automatically resolved. Accepted risks must have a named owner and review date.

## Open Issues and Future Enhancements

| ID | Description | Type | Severity/priority | Owner | Target date | Acceptance impact | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  |  | Defect / Risk / Enhancement / Documentation |  |  |  |  |  |
|  |  | Defect / Risk / Enhancement / Documentation |  |  |  |  |  |
|  |  | Defect / Risk / Enhancement / Documentation |  |  |  |  |  |

Do not describe a release-blocking authorization or data-integrity defect as a future enhancement.

## Support and Change Terms

Complete this section from the governing contract or approved service agreement. This template does not create warranty or support obligations by itself.

```text
Support start date:
Support end/review date:
Support hours and timezone:
Approved support channels:
Severity definitions/reference:
Response targets/reference:
Included support scope:
Excluded support scope:
Bug-fix approval process:
Enhancement request process:
Emergency change approver:
Data correction approver:
Hosting/Supabase billing owner:
Post-support ownership:
```

## Final Handover Checklist

- [ ] Delivered scope matches the accepted release.
- [ ] Production URL, source commit, build, deployment, and Supabase references are recorded.
- [ ] Client owners have access to required provider accounts through secure channels.
- [ ] Credentials are not embedded in the handover package.
- [ ] Production security and building isolation were verified.
- [ ] Backup, restore test, rollback, and recovery owners are documented.
- [ ] Documentation was delivered and its version recorded.
- [ ] Required training and competency sign-offs are complete.
- [ ] User acceptance testing is signed or all conditions are recorded.
- [ ] Known limitations and accepted risks have owners and dates.
- [ ] Open issues and future enhancements are separated.
- [ ] Support and escalation terms reference an approved agreement.
- [ ] The client understands the administrative, security, and operational responsibilities being transferred.

## Acceptance Sign-Off

```text
Acceptance status: Accepted / Accepted with conditions / Rejected

Accepted source commit:
Accepted application build:
Accepted production deployment ID:
Accepted Supabase environment reference:
Conditions or exclusions:
__________________________________________________________
__________________________________________________________

Client Business Owner
Name:
Position:
Date:
Signature/reference:

Client System Administrator
Name:
Date:
Signature/reference:

Delivery Representative
Name:
Position:
Date:
Signature/reference:

Security/Technical Reviewer, if required
Name:
Date:
Signature/reference:
```

Acceptance confirms the recorded scope and conditions. It does not waive unresolved security, data-integrity, contractual, or regulatory obligations.

## Post-Handover Review

Schedule a review after the agreed stabilization period.

```text
Review date:
Production incidents since handover:
Support requests and recurring issues:
Open acceptance conditions:
Backup/recovery status:
Training gaps:
Documentation changes:
Enhancement decisions:
Updated owners and dates:
Result: Closed / Continue stabilization / Escalated
```

## Update This Guide When

- Delivery scope, ownership, environment, deployment, backup, training, support, or acceptance requirements change.
- A new known limitation, accepted risk, or open issue affects client operation.
- A handover review identifies missing assets, evidence, responsibilities, or signatures.

Create a new completed handover record for each formal production transfer rather than overwriting the previously accepted record.
