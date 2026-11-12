# Viewer Role

Viewer is a read-only role for operational data across all buildings. An Admin can select **Viewer (view only)** when creating or editing an account in Account Management. Viewers do not need a building assignment.

Viewers can open grow and load history, mortality and other metrics, harvest/truck history, daily feed usage, electricity readings, and operational reports. Date filters, navigation, and PDF exports remain available. Personal display settings, password recovery, and signing out remain available.

Viewers cannot create, edit, or delete records, complete loading, undo completion, add/load trucks, change mortality or other metrics, or administer accounts. Accounts and income reports retain their Admin-only route restrictions. Inactive and missing profiles are denied access.

## Enable in Supabase

1. Run [sql/viewer-role.sql](../sql/viewer-role.sql) in the poultry project's Supabase SQL Editor as the database owner. Use the production project's normal migration/release process. This file is prepared in the repository; changing the frontend does not execute it.
2. Deploy the updated frontend.
3. As Admin, create an account with the Viewer role, or change an existing account to Viewer. Keep its status Active.
4. Sign in as that account and verify navigation, history, reports, and exports. Editing controls must be hidden or disabled. Confirm `/accounts` and income-report routes are denied.

The migration supports a text/check or enum `Users.role` column and can be rerun. It adds authenticated Viewer SELECT policies for the listed operational tables, restricts profile reads to the Viewer's own profile, and denies income-summary reads. Existing writer policies continue to apply to Admin, Supervisor, and Staff.

Restrictive write policies block INSERT, UPDATE, and DELETE even when older permissive policies grant broad authenticated access. Statement triggers also reject Viewer writes through existing `SECURITY DEFINER` RPCs and TRUNCATE. Missing or inactive profiles cannot write. Database-owner maintenance without an end-user JWT remains available.

The script uses the application's default table names. Adjust its table manifest and `Users` references if the deployment overrides those names. It does not constitute a complete replacement for existing role/building RLS policies. Add equivalent protection when introducing new tables or write endpoints.

## Application enforcement

- `AuthProvider` resolves the active role and exposes `canWrite`.
- Operational pages prevent Viewer edit actions and entry forms.
- The shared Supabase fetch guard checks the latest profile before every REST/storage mutation or POST RPC, including when an open session has been demoted to Viewer.
- Account creation uses a separate nonpersistent Auth client so creating a Viewer does not replace the Admin's session.
- Database policies and triggers enforce read-only access independently of the frontend.

## Verification

Run the application-side regression tests with Node 24 or another Node version supporting TypeScript type stripping:

```powershell
npm.cmd run test:viewer
```

The database tests use an isolated in-memory PostgreSQL engine and dummy records. They never connect to Supabase:

```powershell
npm.cmd install --prefix node_modules/.viewer-validation --no-save --package-lock=false @electric-sql/pglite
node --test scripts/viewer-sql.test.mjs
```

The tests cover Viewer reads, insert/update/delete denial, self-role escalation denial, security-definer RPC denial, TRUNCATE denial, existing writer roles, inactive profiles, and migration repeatability for text/check and enum schemas. Local test results do not establish that the migration has been applied to production.
