# Ideas pipeline

How new tools and features move from idea to prototype to product.

```
idea PR (with mockup)  -->  you merge = approve  -->  lab built + auto-merged  -->  adopted | rejected
(weekly agent)              (one tap, phone)          (agent, guard must pass)       (owner decision)
```

- **Idea PR**: written by the weekly ideation session as one idea file
  (`NNN-short-name.md`, see `TEMPLATE.md`) plus a hand-drawn SVG mockup
  (`NNN-short-name.mockup.svg`), opened as a pull request titled `Idea: ...`.
  Both render in the GitHub mobile app.
- **Merging that PR is the approval.** Closing it unmerged rejects the
  idea. Every idea file on `main` whose status is `proposed` or
  `approved` and that has no `prototype:` yet is approved for prototyping.
- **Lab built and merged by the agent.** The prototyping session builds it
  under `docs/labs/<id>/` on branch `lab/<id>`, opens a `Lab: ...` PR and
  merges it itself (squash) ONLY if the `guard` check is green. The guard
  fails any lab PR that touches a file outside `docs/labs/<id>/` and
  `ideas/<id>.*`, so unattended merging cannot change the real product.
  Anything else (adopting a lab into the product, edits to existing pages)
  is never auto-merged: it waits for the owner.
- **adopted / rejected**: the owner decides after trying the lab page
  (set `status: adopted` or `rejected`). Adopting means a normal
  development task (add it to `NEXT_STEPS.md`); labs code is never wired
  into the main nav automatically.

Rules for agents:

- Ideas must be grounded in the product (see `NEXT_STEPS.md`) and in the
  stated users (compliance teams at EU payment, e-money and crypto
  firms). Any claim about a regulation, date or market must cite a source
  URL; never invent statistics, customers or prices.
- One idea per PR. Do not edit other ideas except to fix a duplicate.
- Prototypes live only in `docs/labs/<id>/`, are static (no build step, no
  third-party requests), show a visible "Lab prototype, not part of the
  product" banner, use clearly labelled demo data, meet the quality floor
  in `NEXT_STEPS.md`, and are not linked from `site-nav.js`, the landing
  page, or any existing page.
- Ideas that need an owner decision (backend, auth, pricing, integrations
  needing real credentials) must be marked `needs_owner: true` and are not
  prototyped beyond a static mock.
