# Ideas pipeline

How new tools and features move from idea to prototype to product.

```
proposed  -->  approved  -->  prototyped  -->  adopted | rejected
(agent PR)    (owner edit)    (agent PR)       (owner decision)
```

- **proposed**: written by the weekly ideation session as one file in this
  folder (`NNN-short-name.md`, see `TEMPLATE.md`), opened as a PR. Merging
  the PR only records the idea; it does not approve it.
- **approved**: the owner changes `status:` to `approved` in the idea's
  front matter (GitHub web editor is fine). Only approved ideas are built.
- **prototyped**: the prototyping session builds it under
  `docs/labs/<id>/`, sets `status: prototyped` and `prototype:` in the
  idea file, and opens a PR.
- **adopted / rejected**: the owner decides after trying the lab page.
  Adopting means a normal development task (add it to `NEXT_STEPS.md`);
  labs code is never wired into the main nav automatically.

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
