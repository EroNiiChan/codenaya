# 0006. Platform provider and models set at runtime in /admin; env is the fallback

- Status: Accepted
- Date: 2026-10-23
- Related: ADR 0005 (its "chosen by env" now applies only until the admin picks
  a provider), #403

## Context

ADR 0005 made the platform provider an env var, so switching it needed an
Infisical change and a redeploy, and the models users could pick were a curated
list in code. The owner wants to switch providers and choose models, defaults
and prices from the app, and later meter usage against those prices.

## Decision

- **One admin**, the verified email in the Convex env var `ADMIN_EMAIL`.
  `convex/admin.ts` `requireAdmin` guards every admin function; anyone else gets
  `NOT_FOUND`. `/admin` and `/api/admin/*` ask Convex `isAdmin` with the
  caller's token, and the proxy answers non-admins with a real 404.
- **Per-provider model selection** in `platformModelConfigs` (one bounded doc
  per provider: models, default, USD prices). The list comes live from the
  provider (`GET /api/admin/models`); a model can't be saved unpriced, and one
  whose tool support is unknown needs the admin's confirmation.
- **Active provider** in `platformSettings` (one row). None means
  `NEXT_PUBLIC_AI_PROVIDER`. Switching goes through `POST /api/admin/provider`,
  which refuses a provider without a key (only Next sees keys) and calls Convex
  as the admin plus the internal key; Convex refuses a provider without saved
  models.
- **One read on the request path.** `activePlatform` (`getActiveForServer`)
  returns the active provider and its selection together. Routes, the Inngest
  run (re-read, not taken from the event) and editor AI resolve through it, and
  the pickers use the reactive `getActive`. An id from another provider or a
  removed model falls back to the default.
- Every admin change writes `adminAuditLog` in the same transaction.

## Alternatives considered

- **Keep the env var as the switch.** It needs a redeploy and can't carry
  prices or a model selection.
- **Admin role in Clerk metadata.** A second source of truth and a JWT template
  change for one person; one Convex env var is enough until there are more admins.
- **Switch from the browser straight to Convex.** Convex can't see which keys
  are set, so it could activate a provider that can't run.

## Consequences

- Provider and model changes apply to every open picker and new run at once.
- The send path and each run do one extra Convex point read.
- Before PR C deploys, prod needs a saved selection so usage can be priced.
