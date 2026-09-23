# Farm Operations Checklist

Use this checklist as the quick daily operating procedure for the GGDC Poultry Management System. It supplements the detailed [User Guide](USER_GUIDE.md) and approved farm husbandry procedures.

Last reviewed: 2026-09-23

## Shift Record

```text
Date: ____________________    Shift: ____________________
Building: _________________    Grow: _____________________
Grow day: _________________    Operator: __________________
Supervisor: _______________    App build: _________________
```

Use the building-local grow label shown by the application, such as `Grow #2`. Record the database ID separately only when technical support requests it.

## Start of Shift

- [ ] Sign in with your own active account.
- [ ] Confirm the displayed role and assigned building are correct.
- [ ] Confirm the physical building and grow match the selected system record.
- [ ] Confirm today's date and calculated grow day.
- [ ] Review yesterday's grow, feed, and electricity records for missing or unusual values.
- [ ] Review pending corrections or handover notes before entering new data.
- [ ] Escalate a missing building, grow, or access permission before recording under another record.

Never share an account or use another building as a temporary substitute.

## Daily Grow Activity

- [ ] Open **My Growers** and select the correct building and active grow.
- [ ] Select the intended record date before entering values.
- [ ] Record the current bird count or required daily grow values.
- [ ] Record mortality, culling, thinning, take-out, or transfer activity in the correct workflow.
- [ ] Record average body weight when a measurement is available and required.
- [ ] Confirm the cage or sub-building before saving cage-level activity.
- [ ] Add a clear remark for unusual activity or an approved correction.
- [ ] Save once and confirm the values appear in the daily view or history.
- [ ] Confirm the remaining bird total is plausible against the previous day and recorded reductions.

Do not enter an invented zero for a value that is unknown. Use zero only when zero is the observed and intended value.

## Daily Feed Usage

- [ ] Open **Daily Feed Usage** for the correct building.
- [ ] Confirm the active grow, age day, and record date.
- [ ] Select the approved feed code.
- [ ] Enter bags and kilograms using the farm's approved units.
- [ ] Add remarks when the quantity, code, or feeding event needs explanation.
- [ ] Save and confirm that the day is no longer pending.
- [ ] Check that the daily entry appears once for the grow and age day.
- [ ] Compare the displayed total with the source record used by the operator.

The visible workflow records daily feed usage only. Do not use legacy received, transfer-in, or transfer-out URLs as part of the current process.

Only Admin can correct or delete a saved feed entry. Staff and Supervisor users should report an error instead of creating a second record for the same grow/day.

## Daily Electricity Reading

- [ ] Open the daily electricity entry for the correct building and grow.
- [ ] Confirm the reading date and age day.
- [ ] Read the physical meter using the approved unit.
- [ ] Enter the meter reading and any required remarks.
- [ ] For day `0`, confirm the baseline reading is present.
- [ ] For later days, compare the reading with the previous saved reading.
- [ ] If the meter reset or was replaced, record the event and approved manual consumption information.
- [ ] Save and confirm the record appears once for the intended day.
- [ ] Review the grow-cycle status for `Complete`, `Needs start`, `Needs end`, or `No records`.

Only Admin can edit a saved electricity reading. Report an incorrect saved reading with the building, grow, date, displayed value, and physical/source value.

## End of Shift Review

- [ ] Confirm today's grow activity is saved for every required cage or sub-building.
- [ ] Confirm today's feed entry is present with the correct feed code and quantity.
- [ ] Confirm today's electricity reading is present.
- [ ] Review report rows for the same building, grow, and date.
- [ ] Confirm no duplicate grow/day feed or electricity records are visible.
- [ ] Record unresolved discrepancies in the handover section.
- [ ] Sign out, especially on a shared device.

## Exception and Correction Handover

Do not hide an error by entering an offsetting value or a duplicate record. Preserve the original evidence and send the correction to an authorized user.

```text
Date/time found: _________________________________________
Reported by: _____________________________________________
Building and grow: _______________________________________
Module: Grow / Feed / Electricity / Harvest / Account / Other
Affected record date or grow day: ________________________
Current displayed value: _________________________________
Expected/source value: ___________________________________
Reason or evidence: ______________________________________
__________________________________________________________
Assigned to: _____________________________________________
Correction completed by/date: ____________________________
Verification result: _____________________________________
```

After an approved historical correction, check later cumulative or dependent values. Feed cumulative kilograms, bird balances, report totals, and grow status may require reconciliation.

## Harvest-Day Checklist

Staff harvest access is restricted unless explicitly approved. Admin or Supervisor should perform the current harvest workflow.

### Before loading

- [ ] Confirm the physical building and active grow.
- [ ] Review the latest current-bird total and unresolved grow reductions.
- [ ] Confirm pending daily feed and electricity records are handled or documented.
- [ ] Confirm the correct harvest and truck record before entry.
- [ ] Record the truck's empty weight in the approved unit.

### During and after loading

- [ ] Enter animals loaded for the correct truck.
- [ ] Enter loaded weight using the same unit as empty weight.
- [ ] Confirm loaded weight is not below empty weight.
- [ ] Review calculated net weight and average bird weight.
- [ ] Record harvest mortality, defects, or other reductions in the correct workflow.
- [ ] Complete the truck only after its values have been checked.
- [ ] Confirm the harvest total changed by the intended amount.
- [ ] Confirm remaining birds agree with physical and operational records.

### Before completing the grow

- [ ] Confirm every truck belongs to the correct harvest and grow.
- [ ] Confirm completed truck animal counts equal the expected harvested total.
- [ ] Confirm harvest reductions are complete and not duplicated.
- [ ] Confirm harvest remaining has reached the approved closing balance.
- [ ] Confirm the grow status changes to `Harvested` only when the workflow is complete.
- [ ] Review the Harvested Grow History report before final sign-off.

## Grow Closeout Reconciliation

Complete this review before distributing final reports or preparing an income summary.

- [ ] Initial grow total agrees with the approved load records.
- [ ] Daily grow reductions agree with their source transactions and logs.
- [ ] Current birds agree with the latest valid grow state.
- [ ] Harvested total agrees with effective completed truck animal counts.
- [ ] Harvest reductions agree with their source transactions.
- [ ] Harvest remaining is reconciled and the status/harvested flag agree.
- [ ] Daily feed entries contain no duplicate grow/age-day records.
- [ ] Daily feed totals agree with the Daily Feed report.
- [ ] Feed-code summary differences are investigated against `FeedUsageSummary`.
- [ ] Electricity has the required starting and ending readings.
- [ ] Complete grow-cycle kWh agrees with ending reading minus starting reading.
- [ ] Active and harvested reports place the grow in the correct category.
- [ ] PDFs were generated after final corrections and contain the intended building only.
- [ ] Any manually prepared Income Summary values were compared with operational reports.

See [Business Rules](BUSINESS_RULES.md) for formulas and [Report Catalog](REPORT_CATALOG.md) for report-specific interpretation.

## Supervisor Daily Sign-Off

```text
Grow activity complete:        Yes / No / N/A
Feed record complete:          Yes / No / N/A
Electricity record complete:   Yes / No / N/A
Exceptions documented:         Yes / No / N/A
Corrections assigned:          Yes / No / N/A

Supervisor name: _________________________________________
Review date/time: _________________________________________
Signature/reference: ______________________________________
Notes: ____________________________________________________
__________________________________________________________
```

## Grow Closeout Sign-Off

```text
Building: ____________________    Grow: ____________________
Start date: __________________    Finish date: _____________
Final operational review by: ______________________________
Report review by: _________________________________________
Open discrepancies: None / Listed below
__________________________________________________________
Final approval name/date: __________________________________
PDF or report reference: __________________________________
```

## Escalation Rules

Escalate immediately when:

- The selected building or grow does not match the physical operation.
- Bird arithmetic would become negative or totals differ materially from source records.
- A meter reading is below the previous reading without a documented reset or replacement.
- A completed or harvested grow appears editable through an unauthorized workflow.
- Staff can view or change another building's records.
- Supervisor or Staff can perform an Admin-only correction.
- A report or PDF contains another building's restricted data.
- Account role, status, or building assignment is incorrect.

For access incidents, follow [Security Guide](SECURITY_GUIDE.md). For detailed role boundaries, use [Role and Access Matrix](ROLE_ACCESS_MATRIX.md).

## Checklist Ownership

Operations or Training owns this checklist. The Business Owner approves workflow changes, and Development confirms that the steps still match the application.

Update this checklist whenever a daily screen, field, role permission, formula, status, report, correction path, or closeout procedure changes.
