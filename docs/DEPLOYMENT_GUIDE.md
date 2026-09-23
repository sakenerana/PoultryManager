# Deployment and Operations Guide

This guide covers production deployment of the GGDC Poultry Management System, including environment setup, Supabase configuration, static hosting, PWA updates, verification, backup, and rollback.

The application is a client-side React and Vite single-page application. A production build creates static files in `dist/`; no Node.js application server is required after the build.

## Deployment Overview

System administrators coordinating release readiness and post-release business verification should also use the [System Administrator Runbook](SYSTEM_ADMIN_RUNBOOK.md).

```text
Source repository
  -> install dependencies
  -> configure VITE_* build variables
  -> type-check and Vite build
  -> deploy the complete dist/ directory
  -> serve through HTTPS with SPA fallback
  -> connect to Supabase Auth and database
```

Environment variables are embedded into the browser bundle during the build. Changing a hosting variable does not update an already-built deployment; rebuild and redeploy the complete `dist/` directory.

## Prerequisites

- A supported Node.js LTS release compatible with the installed Vite version
- npm and the committed `package-lock.json`
- Access to the production hosting service
- Access to the correct Supabase project
- A configured production domain with HTTPS
- A current database backup before database or application changes that affect stored data

Use the same Node.js version in development and CI where possible. Pinning the version in the hosting service reduces differences between local and production builds.

## Environment Configuration

### Required variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

The application reads these values in `src/utils/supabase.ts`.

All `VITE_*` variables are public because Vite embeds them in client-side JavaScript. The Supabase anonymous/public key is intended for browser use when Row Level Security is correctly configured. Never use a Supabase service-role key in this application, a `VITE_*` variable, or the hosting provider's frontend environment.

For local development, prefer `.env.local`. The repository ignores `*.local` files. Do not commit credentials.

### Optional variables

The application supports optional table, column, RPC, and PDF URL overrides. Their full list is documented in the main README. Set an override only when the target Supabase schema differs from the application's default names.

Production values should be configured in the hosting provider's environment settings. Keep separate values for preview/staging and production deployments.

## Supabase Preparation

Before the first production deployment:

1. Create or select the production Supabase project.
2. Apply the required tables, relationships, constraints, indexes, and RPC functions.
3. Configure Row Level Security policies for authenticated access, user roles, and building assignments.
4. Create the initial authorized administrator account and matching `Users` record.
5. Configure Auth email delivery and password-reset behavior.
6. Add the production domain to the allowed Site URL and redirect URL settings.
7. Test Admin, Supervisor, and Staff permissions independently.

See [DATABASE_GUIDE.md](DATABASE_GUIDE.md) for application-used tables and columns. The repository does not contain an authoritative SQL migration history, so compare the live Supabase schema before every structural change.

## Password Reset URL

The current forgot-password page sends users to:

```text
https://ggdc-poultry-manager.cficoop.com/reset-password
```

This exact URL must be allowed in Supabase Auth redirect settings. If deploying under another domain, update the redirect URL in `src/pages/ForgotPasswordPage.tsx`, add the new URL to Supabase Auth, rebuild, and redeploy.

Test the complete email link flow after changing domains. A successful login test does not verify password recovery.

## Install Dependencies

For repeatable CI and production builds, install the exact dependency versions from the lockfile:

```bash
npm ci
```

For normal local development where lockfile updates may be intended:

```bash
npm install
```

Do not deploy `node_modules`; only the generated `dist/` output is required by the static host.

## Validate Before Building

Run linting:

```bash
npm run lint
```

Run the TypeScript build check without creating deployment files or incrementing the app build number:

```bash
npx tsc -b
```

Review pending changes before the production build:

```bash
git status --short
git diff --check
```

Full-project lint may expose existing issues unrelated to a narrow deployment. Record any accepted exceptions; do not silently treat a failing check as passed.

## Create the Production Build

```bash
npm run build
```

The command runs:

1. `prebuild`, which executes `scripts/increment-build-version.mjs`.
2. `tsc -b`, which compiles and type-checks the project.
3. `vite build`, which writes the production files to `dist/`.

The prebuild step updates:

```text
src/generated/appVersion.ts
```

This version is displayed by the application and helps users confirm that an update was installed. Decide whether a build number belongs to the release before committing it. A local validation build also increments the file; restore only that generated file when the increment is not intended for release.

The build process needs permission to write to `src/generated/appVersion.ts`.

## Preview the Build

```bash
npm run preview
```

Open the local preview URL and test the built application rather than relying only on the development server. The preview is for validation and is not a production server.

Check at least:

- Login and sign out
- Password-reset route loading
- Dashboard navigation
- One read and one permitted write against the intended Supabase environment
- Direct loading of a nested route
- Feed and electricity pages
- PDF/report generation
- Mobile layout
- PWA manifest and icons

Do not write test records into production unless they are clearly controlled and removed through an approved process.

## Static Hosting Requirements

Deploy the complete contents of `dist/` to a static host or web server.

Required hosting behavior:

- Serve the site through HTTPS.
- Use `dist/index.html` as the application entry point.
- Rewrite unknown application routes to `/index.html` for React Router.
- Serve existing assets such as JavaScript, CSS, icons, `manifest.webmanifest`, and `service-worker.js` directly instead of rewriting them.
- Preserve correct JavaScript, CSS, JSON/manifest, PNG, SVG, and service-worker content types.
- Deploy at the domain root unless the application's asset paths, manifest, service worker, and Vite base are updated for a subpath.

Without an SPA fallback, refreshing routes such as `/reports` or `/reset-password` can return a hosting 404 even though navigation inside the application works.

No provider-specific configuration is currently committed. Configure the equivalent rewrite or fallback rule in the selected hosting platform.

## Cache Headers

Recommended cache behavior:

| Resource | Suggested policy |
| --- | --- |
| `index.html` | Revalidate or short/no cache |
| `service-worker.js` | No cache or always revalidate |
| `manifest.webmanifest` | Short cache/revalidate |
| Hashed files under `assets/` | Long cache with `immutable` |
| Non-hashed public files | Short cache or revalidate according to update needs |

Avoid long immutable caching for `index.html` and `service-worker.js`; doing so can delay new releases.

## PWA and Service Worker

The application registers `/service-worker.js` and uses `/manifest.webmanifest`. Both assume deployment at the origin root.

The service worker:

- Pre-caches `/`, `/index.html`, and `/manifest.webmanifest`.
- Uses network-first behavior for page navigation with an offline `index.html` fallback.
- Uses runtime caching for same-origin static assets.
- Bypasses caching for Supabase and JSON/API requests.
- Removes older cache names during activation.
- Supports a user-triggered update through `SKIP_WAITING`.

Current cache names are `ggdc-static-v4` and `ggdc-runtime-v4`. When changing cache strategy or pre-cached content, increment the cache version so stale caches are removed on activation.

PWA installation and service-worker behavior require HTTPS in production. Localhost is the browser-supported development exception.

After deployment, users can select **Sync latest update** in the application. When a waiting service worker is found, the app offers **Update now** and reloads after activation.

## Deployment Procedure

1. Confirm the target environment and release scope.
2. Back up the database when the release includes schema or data changes.
3. Pull or check out the exact release commit in a clean build environment.
4. Configure the production `VITE_*` variables without printing their values in logs.
5. Run `npm ci`.
6. Run linting and TypeScript validation.
7. Run `npm run build`.
8. Review the generated build number and build output.
9. Preview and smoke-test `dist/` against the intended environment.
10. Deploy the complete `dist/` directory atomically when supported.
11. Verify the public site, nested routes, Supabase connectivity, and password reset.
12. Confirm the displayed application version and PWA update behavior.
13. Record the deployed commit, build number, deployment time, operator, and any database migration version.

Do not mix files from different builds. Vite's generated HTML references specific hashed assets, so partial uploads can produce blank pages or failed module loads.

## Post-Deployment Verification

Use an incognito/private browser session first to avoid relying on an existing service-worker cache.

Verify:

- The production domain loads over HTTPS without certificate errors.
- Login succeeds for an active account.
- An inactive account is denied as expected.
- Admin, Supervisor, and Staff menus match their intended access.
- Direct navigation to a protected nested route loads the application.
- Building and grow data comes from the correct Supabase project.
- A permitted test operation saves and reloads correctly.
- Feed and electricity summaries load without missing-schema errors.
- Reports and PDFs render successfully.
- Password-reset emails return to the production `/reset-password` route.
- The manifest and icons load, and PWA installation is available on a supported browser.
- The displayed build version matches the deployed release.

Monitor browser errors and Supabase logs immediately after release.

## Backup and Recovery

Frontend deployment files are not a database backup.

Before a risky release:

- Confirm a recent Supabase backup or create an approved database export.
- Preserve the currently deployed `dist/` artifact or provider deployment identifier.
- Record the current source commit and application build number.
- Preserve the previous environment-variable configuration securely.
- Document any schema migration and its tested rollback path.

Periodically test recovery in a non-production environment. A backup that has never been restored is not a verified recovery plan.

## Rollback Procedure

For a frontend-only problem:

1. Identify the last known-good deployment artifact and commit.
2. Restore that complete deployment through the hosting provider's rollback feature or redeploy its full `dist/` output.
3. Verify `index.html`, hashed assets, and `service-worker.js` all belong to the same build.
4. Test in a private browser session.
5. Use the in-app update action or reload once the previous service worker becomes available.
6. Confirm login, nested routes, and a core read operation.

For a release that changed the database:

1. Stop further writes if continued use can corrupt or lose data.
2. Determine whether the old frontend is compatible with the new schema.
3. Run only a previously tested database rollback or forward-fix migration.
4. Restore data from backup only through an approved recovery process.
5. Validate record counts, relationships, and representative farm workflows before reopening access.

Do not roll back the frontend blindly when the database schema is no longer backward-compatible.

## Troubleshooting

### The site works from the home page but nested routes return 404

Configure the static host to rewrite unknown application routes to `/index.html` while serving real files directly.

### The deployment still connects to the old Supabase project

Confirm which `VITE_SUPABASE_URL` was present during the build. Update the hosting build environment, rebuild, and redeploy the complete output. Runtime changes do not modify an existing Vite bundle.

### Users continue seeing the previous version

Verify that the new `service-worker.js` and `index.html` are not held by a long-lived CDN cache. Confirm the new build number, then use **Sync latest update** or reload in a private browser session.

### The PWA cannot be installed

Confirm HTTPS, a valid `/manifest.webmanifest`, reachable 192x192 and 512x512 icons, and successful service-worker registration. Installation support also varies by browser and device.

### Password-reset links fail

Confirm the exact production `/reset-password` URL is allowed by Supabase Auth and matches the URL sent by `ForgotPasswordPage.tsx`. Check for expired links before changing application code.

### The build unexpectedly modifies a source file

This is expected for `src/generated/appVersion.ts`. The `prebuild` script increments the app build number. Keep the change for a release build or restore only that file when the build was for local validation.

### The deployed page is blank

Check the browser console and network panel for missing hashed JavaScript/CSS files, wrong MIME types, mixed build artifacts, an incorrect subpath, or missing environment values. Redeploy the complete matching `dist/` directory after fixing the cause.

## Release Record Template

For a formal production transfer or client acceptance, attach this release record to the completed [Client Handover Guide](CLIENT_HANDOVER.md).

```text
Release date:
Operator:
Environment:
Production domain:
Source commit:
App version/build:
Supabase project:
Database migration/version:
Backup reference:
Hosting deployment ID:
Smoke-test result:
Rollback artifact/deployment ID:
Notes:
```
