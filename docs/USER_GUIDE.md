# GGDC Poultry Management System User Guide

New users should complete the role-appropriate exercises in the [Staff Training Guide](STAFF_TRAINING_GUIDE.md) before receiving production access.

This guide explains the day-to-day use of the poultry management system for farm staff, supervisors, and administrators.

## User Roles

| Role | Typical access |
| --- | --- |
| Admin | All assigned operational pages, account management, building setup, corrections, reports, feed, and electricity records |
| Supervisor | Operational pages and management reports allowed by the configured route permissions |
| Staff | Daily operations for the building assigned to the account |

An account must have an `Active` status. Staff accounts should be assigned to the correct building before they begin recording data.

## Sign In and Navigation

1. Open the application and enter your registered email and password.
2. Select **Sign In**.
3. Use the dashboard to open **My Growers**, **Harvest**, **Reports**, **Electricity Consumption**, or **Daily Feed Usage**.
4. Use the back arrow to return to the previous screen or the home icon to return to the dashboard.
5. Use the sign-out button when finished, especially on a shared device.

If you forget your password, select **Forgot Password** on the sign-in screen and follow the reset instructions sent to your email.

## Recommended Daily Workflow

For shift use and supervisor sign-off, print or open the [Farm Operations Checklist](FARM_OPERATIONS_CHECKLIST.md).

Complete records in this order so that reports use the latest farm data:

1. Review the active grow and select the correct record date.
2. Record cage activity: mortality, thinning, take out, and average weight.
3. Record the day's feed usage.
4. Record the electricity meter reading.
5. Review the relevant report for missing or unusual values.

Always confirm the building, grow number, day, and date before saving a record.

## Start a Grow Cycle

Administrators or authorized supervisors use this workflow when chicks are loaded into a building.

1. From the dashboard, open **My Growers**.
2. Select the required building.
3. Open the building load screen.
4. Select the transaction date and enter the number of animals loaded into each applicable cage.
5. Review the displayed total.
6. Select **Save Building Load** and confirm the action.
7. Add further loads on their actual dates when a grow is loaded in multiple deliveries.
8. Complete the loading process when all expected animals have been recorded.

The building's active grow remains editable only while its status permits loading or growing activity. Do not create a second active grow for the same building.

## Record Daily Grow Activity

1. From **My Growers**, select the building and open its cage activity screen.
2. Choose the correct date.
3. Select a cage.
4. Record the applicable values:
   - **Mortality** - birds found dead.
   - **Thinning** - birds removed as part of thinning activity.
   - **Take Out** - other birds removed from the cage.
   - **Avg. Weight** - sampled average body weight.
5. Review the entry and save it.
6. Repeat for each cage with activity for that date.

Use zero only when zero is the intended recorded value. Check the metric history when correcting an earlier date. A harvested or otherwise closed grow cannot be edited from the daily cage screen.

## Record Daily Feed Usage

The active feed workflow records daily usage only. Feed received, transfer-in, and transfer-out screens are not part of the current operator workflow.

1. From the dashboard, open **Daily Feed Usage**.
2. Select the building and active grow.
3. Use **All**, **Recorded**, or **Pending** to locate the required grow day.
4. Select the correct day.
5. Confirm the displayed grow, day, and date.
6. Select the **Feed Code**: `510`, `511`, `512`, or `513`.
7. Enter **QTY Bags** and **QTY KG**.
8. Add remarks when clarification is needed.
9. Save the entry and confirm that the day is shown as recorded.

Only administrators can modify or delete an existing daily feed entry. Other users should report a correction to an administrator instead of creating a duplicate record.

## Record Electricity Consumption

1. From the dashboard, open **Electricity Consumption**.
2. Open the daily entry screen.
3. Select the building and record date.
4. Enter the meter reading shown on the physical meter.
5. Save the record.
6. Review the grow-cycle summary after the starting and ending readings have been entered.

Grow-cycle electricity records use these statuses:

| Status | Meaning | Action |
| --- | --- | --- |
| Complete | Both required readings are available | No correction is required |
| Needs start | The starting reading is missing | Enter or correct the grow's starting reading |
| Needs end | The ending reading is missing | Enter the final reading when the grow closes |
| No records | No electricity entries are available | Add the required daily meter records |

A complete grow-cycle total is calculated as ending meter reading minus starting meter reading. Check the physical reading and selected date before correcting an unexpected value.

## Record a Harvest

1. Open **Harvest** from the dashboard.
2. Select the building and active grow to be harvested.
3. Add the required truck details.
4. Record the animals loaded and the applicable truck weights.
5. Review each truck entry before saving.
6. Repeat for additional trucks.
7. Review harvest totals and history before treating the grow as complete.

Do not close a grow until all trucks and final reductions have been recorded. Correct truck records before producing the final report.

## View and Export Reports

1. Open **Reports** from the dashboard.
2. Select the required report:
   - Active grows
   - Harvested grows
   - Income
   - Electricity consumption
   - Daily feed usage
3. Select the building, grow, or date filters requested by the report.
4. Review totals and missing-data statuses.
5. Use the available PDF export action when a printable copy is required.

Resolve missing feed or electricity records before distributing a final report. Grow labels such as `Grow #1` are numbered within each building and are not database IDs.

## Manage User Accounts

Only administrators should manage user accounts.

Administrators should follow the approval, verification, deactivation, and recordkeeping procedures in the [System Administrator Runbook](SYSTEM_ADMIN_RUNBOOK.md).

1. Open **Accounts** from the dashboard.
2. Select **Add User Account**.
3. Enter the user's full name, email, password, and password confirmation.
4. Select the role: `Admin`, `Supervisor`, or `Staff`.
5. For a Staff account, select the correct **Building Access**.
6. Set the status to `Active` and save.

To prevent access without deleting an account, edit the user and set the status to `Inactive`. Review the role and assigned building whenever a staff member changes responsibilities.

## Settings and Installation

Open **Settings** to adjust the application's text size. Save the preference after reviewing the preview. The page also shows whether the application can be installed as a Progressive Web App on the current device.

When installation is available, use the install action and follow the browser prompt. The installed application still requires a network connection for live Supabase data.

## Corrections and Troubleshooting

### A record was saved under the wrong date

Open the same module, select the correct building and grow, and review the existing entry. Administrators can correct supported records. Avoid entering a second record for the same day unless the workflow explicitly permits multiple transactions.

### A building or grow is missing

Confirm that the account is active and has access to the required building. Staff users should ask an administrator to verify their building assignment. Also confirm that the grow is active for the selected date.

### A page cannot be opened

The page may be restricted by role. Return to the dashboard and use the available menu options. If the user should have access, ask an administrator to verify the account role and status.

### Electricity shows a missing reading

Use the displayed status to identify whether the starting or ending reading is absent, then add or correct the corresponding daily meter record.

### Feed shows a pending day

Open the pending day, verify its date and grow number, then save the feed code and quantities. If an incorrect entry already exists, ask an administrator to edit or delete it.

### Data does not appear after saving

Confirm that the save action completed successfully, then return to the list or refresh the page. Check the internet connection before entering the record again to avoid duplicates.

## Data Entry Checklist

Before saving:

- Confirm the building and grow number.
- Confirm the selected date and grow day.
- Use the same unit shown by the form.
- Compare meter readings and animal totals with the source record.
- Add remarks for unusual activity or corrections.

At the end of the day:

- Check pending feed days.
- Check electricity data status.
- Review mortality and animal totals.
- Confirm that all required entries appear in reports.
- Sign out on shared devices.
