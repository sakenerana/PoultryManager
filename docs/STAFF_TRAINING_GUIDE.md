# Staff Training and Onboarding Guide

This guide provides role-based onboarding and competency assessment for users of the GGDC Poultry Management System. It is intended for trainers, supervisors, administrators, and new users.

Last reviewed: 2026-09-23

## Training Principles

- Train users with a non-production Supabase environment whenever an exercise creates, changes, or deletes data.
- Give each trainee a separate account with the role and building scope being assessed.
- Use clearly labeled test buildings, grows, dates, and records.
- Never use shared production credentials or disclose another user's password.
- Demonstrate the correct workflow, then require the trainee to perform it without step-by-step prompting.
- Assess denied actions as well as allowed actions.
- Do not grant production access solely because training was attended; require competency sign-off and access approval.
- Retrain users after material workflow, role, formula, or security changes.

This guide trains system use. It does not replace approved poultry husbandry, occupational safety, biosecurity, or emergency procedures.

## Training Roles

| Training role | Responsibility |
| --- | --- |
| Business Owner | Approves role responsibilities and production access expectations |
| Trainer | Delivers instruction, prepares exercises, and records observed results |
| Supervisor | Confirms operational readiness and building assignment |
| System Administrator | Creates approved accounts and applies role/status/building access |
| Trainee | Uses an individual account, completes exercises, and reports uncertainty or errors |
| Security or QA reviewer | Reviews high-risk Admin training and authorization checks when required |

The trainer should not certify their own high-privilege access without an independent reviewer.

## Required Training Environment

Prepare these before the session:

- One active Admin training account.
- One active Supervisor training account.
- One active Staff training account assigned to Training Building A.
- A second Training Building B that Staff must not access.
- One active test grow with known starting birds and day `0`.
- At least one cage/sub-building.
- Approved test feed codes and sample quantities.
- Sample electricity baseline and later meter readings.
- Sample harvest and truck records for Supervisor/Admin exercises.
- Known expected report totals.
- A documented cleanup owner and method.

Do not connect training accounts to production unless the exercise is an approved read-only orientation with no sensitive data exposure.

## Training Materials

Use these documents during training:

| Document | Training use |
| --- | --- |
| [User Guide](USER_GUIDE.md) | Detailed screen and workflow instructions |
| [Farm Operations Checklist](FARM_OPERATIONS_CHECKLIST.md) | Daily and harvest shift procedure |
| [Role and Access Matrix](ROLE_ACCESS_MATRIX.md) | Allowed and denied capabilities |
| [Business Rules](BUSINESS_RULES.md) | Terms, formulas, statuses, and lifecycle rules |
| [Report Catalog](REPORT_CATALOG.md) | Filters, report sources, exports, and reconciliation |
| [System Administrator Runbook](SYSTEM_ADMIN_RUNBOOK.md) | Administrative approvals, corrections, incidents, and handover |
| [Security Guide](SECURITY_GUIDE.md) | Account, data-access, and incident expectations |

## Common Foundation

Every role must complete these topics before role-specific exercises.

### Account and security

The trainee can:

- [ ] Sign in using their own account and sign out correctly.
- [ ] Identify their role, status, and assigned building.
- [ ] Explain why accounts and passwords must not be shared.
- [ ] Use **Forgot Password** without asking an administrator to reveal a password.
- [ ] Recognize that hidden buttons do not replace database authorization.
- [ ] Report cross-building data, unexpected permissions, or exposed credentials immediately.

### Navigation and record identity

The trainee can:

- [ ] Open the dashboard and locate permitted modules.
- [ ] Confirm building, grow, date, and grow day before saving.
- [ ] Explain that user-facing `Grow #N` labels are sequenced within a building.
- [ ] Distinguish a grow label from a technical database ID.
- [ ] Return to the dashboard and recover from an incorrect selection without saving.

### Data quality

The trainee can:

- [ ] Use zero only when zero is the intended observed value.
- [ ] Add useful remarks for unusual activity.
- [ ] Verify a saved value by reloading or reviewing history.
- [ ] Avoid duplicate or offsetting records when a mistake is found.
- [ ] Complete an exception/correction handover instead of exceeding their permission.

## Staff Training Path

Staff training focuses on current daily operations for one assigned building.

### Required topics

- Assigned-building access.
- Daily grow and cage activity.
- Daily feed usage.
- Daily electricity readings.
- Operational report review.
- Exception reporting and end-of-shift handover.

### Staff practical exercises

1. Sign in as Staff assigned to Training Building A.
2. Confirm Training Building B is not visible or accessible through direct navigation.
3. Open the active grow and identify its building-local grow number, date, and grow day.
4. Enter approved current-day grow activity for the correct cage.
5. Verify the saved activity in the appropriate history or summary.
6. Enter one daily feed record using the approved code, bags, kilograms, and remarks.
7. Confirm the feed day changes from pending to recorded and does not create a duplicate.
8. Enter an electricity reading and explain the day-`0` baseline behavior.
9. Identify `Complete`, `Needs start`, `Needs end`, and `No records` electricity statuses.
10. Open allowed reports and confirm their building and date filters.
11. Attempt an Admin-only saved feed/electricity correction and confirm it is denied.
12. Complete an exception handover for a deliberately incorrect sample record.
13. Sign out from the shared training device.

### Staff competency standard

The trainee passes when they complete all current-day entries under the correct building, grow, day, and date without unauthorized access, duplication, or trainer intervention on critical fields.

## Supervisor Training Path

Supervisor training includes the Staff path plus current operational oversight.

### Required topics

- Building creation and grow setup where approved.
- Review of daily completion and exception handovers.
- Current harvest truck workflow.
- Operational report validation.
- Staff coaching and escalation.
- Boundaries between current operations and Admin-only historical correction.

### Supervisor practical exercises

1. Complete the Common Foundation and Staff exercises using Supervisor access.
2. Create an approved test building and verify its expected cages/sub-buildings.
3. Start and complete a test grow-loading workflow with known values.
4. Confirm daily grow, feed, electricity, and report screens reference the new grow.
5. Review a Staff shift record and identify one missing entry.
6. Manage a current-date test harvest truck: empty weight, animals loaded, loaded weight, review, and completion.
7. Verify harvest totals and remaining birds against the sample source values.
8. Review Active Grows, Harvested Batches, Daily Feed, and Electricity reports.
9. Attempt a previous-date correction, saved feed/electricity edit, account action, and income-summary route.
10. Confirm Admin-only operations are denied and explain the escalation path.
11. Complete a supervisor daily sign-off with one documented exception.

### Supervisor competency standard

The trainee passes when they can supervise daily completion, manage approved current operations, reconcile sample harvest/report values, and consistently escalate Admin-only work.

## Admin Training Path

Admin training includes the Staff and Supervisor concepts plus privileged corrections, account administration, restricted reports, and operational governance.

### Required topics

- User account lifecycle and least-privilege assignment.
- Staff building assignment and access verification.
- Historical correction approval and evidence.
- Saved feed and electricity correction.
- Report and grow-closeout reconciliation.
- Income Summary handling.
- Security incident recognition and escalation.
- Release, backup, and administrator handover responsibilities.

### Admin practical exercises

1. Create a test Staff account assigned to Training Building A.
2. Verify the Auth user and matching application profile.
3. Test allowed Building A access and denied Building B access.
4. Change the test account's approved role or building and verify both gained and removed access.
5. Set the profile to `Inactive` and verify role-protected access is denied.
6. Restore the approved training state without deleting required evidence.
7. Process a correction request containing before value, expected value, reason, approver, and reviewer.
8. Correct one saved feed or electricity record and reconcile dependent totals.
9. Reconcile one complete grow across load, reductions, feed, electricity, harvest, status, and reports.
10. Review an Income Summary against operational source reports.
11. Generate a report PDF and confirm filters, identifiers, totals, and building scope.
12. Respond to a simulated cross-building data incident using the Security Guide.
13. Complete an administrative change record and administrator handover.

### Admin competency standard

The trainee passes when they demonstrate least-privilege account management, evidence-backed corrections, complete reconciliation, secure incident escalation, and accurate administrative records.

High-risk Admin tasks should be independently observed by the Business Owner, Security owner, or another authorized reviewer.

## Knowledge Check

The trainee should answer these without opening the system:

1. Which four values must be confirmed before saving a daily record?
2. Why can `Grow #2` be different from database grow ID `2`?
3. Who may edit an already saved feed or electricity record?
4. What should a user do instead of creating a duplicate to correct an error?
5. What does electricity status `Needs start` mean?
6. How is complete grow-cycle electricity calculated?
7. Why can a daily electricity report total differ from the grow-cycle total?
8. Why must a Staff user be tested against an unassigned building?
9. Who may manage current harvest truck loading, and what is Staff's default access?
10. Why is a hidden tile not sufficient authorization?
11. What must be reconciled before a grow is treated as complete?
12. What information must be preserved when reporting an access incident?

The trainer should review incorrect answers and repeat the related practical exercise.

## Competency Assessment

Rate each area as `Pass`, `Needs coaching`, or `Not assessed`.

| Competency | Result | Evidence or notes |
| --- | --- | --- |
| Secure sign-in, recovery, and sign-out |  |  |
| Correct building/grow/date/day selection |  |  |
| Daily grow activity |  |  |
| Daily feed usage |  |  |
| Daily electricity reading |  |  |
| Report filtering and interpretation |  |  |
| Error handover and escalation |  |  |
| Role and building boundaries |  |  |
| Harvest workflow, if applicable |  |  |
| Account administration, if applicable |  |  |
| Historical correction, if applicable |  |  |
| Reconciliation and sign-off, if applicable |  |  |

A critical failure includes saving under the wrong building/grow/date, exposing another building's data, sharing credentials, bypassing approval, or performing an unauthorized correction. Resolve and reassess before production access.

## Production Access Approval

```text
Trainee name:
Position:
Approved role: Admin / Supervisor / Staff
Assigned building, if Staff:
Training environment:
Training dates:
Trainer:
Practical assessment result:
Knowledge check result:
Open coaching items:
Production access approved by:
Approval date:
Account created/updated by:
Access verification completed by:
Next refresher date:
```

The System Administrator should grant only the approved role and building scope, then verify denied access as well as allowed access.

## Employee Transfer

When a user changes building or responsibility:

- [ ] Obtain approval and effective date.
- [ ] Identify training required for the new role or building workflow.
- [ ] Complete the relevant practical exercises.
- [ ] Record the previous and new role/building.
- [ ] Update access only after training and approval.
- [ ] Have the user sign out and sign in again.
- [ ] Verify new access and verify old access is removed.
- [ ] Schedule follow-up coaching when responsibilities expanded.

## Offboarding

- [ ] Confirm identity, final working date, and approver.
- [ ] Preserve pending work and handover records.
- [ ] Set the application profile to `Inactive` at the approved time.
- [ ] Coordinate Auth session revocation or account disablement with the Security owner.
- [ ] Confirm protected access is denied.
- [ ] Do not reuse or transfer the account credentials.
- [ ] Retain required training and access records according to policy.

## Refresher Training Triggers

Repeat the affected training and reassess competency when:

- A user's role or assigned building changes.
- A daily, harvest, report, correction, or account workflow changes.
- A formula, feed code, electricity status, or grow lifecycle rule changes.
- An incident or repeated data error shows a training gap.
- The user has not performed a critical workflow for the approved refresher period.
- A release materially changes navigation, permissions, or required fields.

## Training Session Record

```text
Session ID:
Date and duration:
Environment and app build:
Trainer:
Trainee(s):
Role track:
Documents used:
Exercises completed:
Test data reference:
Assessment result:
Coaching required:
Cleanup owner/result:
Trainer signature/reference:
Trainee acknowledgment:
Independent reviewer, if required:
```

Do not include passwords, private keys, real production credentials, or unnecessary personal information in training records.

## Update This Guide When

- A role, route, permission, building scope, workflow, field, formula, status, or report changes.
- The competency standard or production-access approval process changes.
- A production incident or recurring support issue reveals a missing training exercise.
- New training environments, cleanup rules, or refresher requirements are approved.

Training changes should be coordinated with the User Guide, Farm Operations Checklist, Role and Access Matrix, Business Rules, Testing Guide, and System Administrator Runbook.
