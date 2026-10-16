# Decision: a free, portable stack for a fully working prototype

**Recommendation:** Option A: Postgres-based backend on a free tier (Supabase
or equivalent) in an EU region, behind the storage adapter from the data spine,
with everything portable so the first paid contract is a plan upgrade or a move
of an SQL dump, not a rewrite.

**Why now:** the owner wants a fully working multi-user prototype, free until
the first contract. The data spine (F1) must be designed for it from day one.

## Options

- **A. Managed Postgres + auth on a free tier, static front end on GitHub or
  Cloudflare Pages.** Real accounts, shared data, row-level security by
  organisation, file storage, scheduled jobs. Standard Postgres means we can
  move to any host. Free tiers have limits and may pause inactive projects, so
  we verify the current terms before relying on them.
- **B. Self-hosted open source on a small server.** Cheapest at scale, but we
  would operate it (backups, security, updates). Not for a prototype.
- **C. Stay static.** Free and simple, but no shared data, roles or connectors.

## Rules that keep it portable and safe
1. All schema in SQL migration files in the repo; no vendor-only features in
   core tables. A script exports and restores a whole tenant.
2. One storage adapter interface; the browser never talks to the database
   except through it.
3. Row-level security keyed by organisation from the first table.
4. Prototype data is fictional or pseudonymised only. No real customer
   personal data until a paid plan, an EU region, a data processing agreement
   and the security review are in place.
5. AI stays bring-your-own-key during the prototype, so it costs us nothing.
6. Secrets only in the host's secret store, never in the repo.

## What the owner must do (the assistant cannot)
Create the hosting account and project, choose the EU region, and add the
keys as repository secrets. We then script everything else.

## Evidence
To be filled from the provider's current documentation before we commit
(free-tier limits, inactivity policy, EU regions, export tools). No limits or
prices are assumed here.
