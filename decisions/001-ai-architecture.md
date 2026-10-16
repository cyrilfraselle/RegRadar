# Decision: How does the AI reach a model?

**Recommendation:** Option A now (bring your own key, in the browser), then
Option B when the backend exists.

**Why now:** AI-native is a product principle, and the static site has no
server. A model key cannot live in public page code, so we must pick a path
before building the assistant features.

## Options

- **A. Bring your own key (BYOK), direct from the browser.** The user pastes a
  model API key; it stays in their browser storage and calls go straight from
  their device to the model provider. No backend, no key custody, works
  today, and compliance teams keep control of cost and data. Downsides: each
  user needs a key; the key sits in browser storage (clear warning, easy to
  clear); some providers restrict direct browser calls (we verify first).
  Fully reversible.
- **B. Managed proxy (serverless function or backend).** We hold the provider
  key, add auth, rate limits, redaction, logging and EU-region processing.
  Best for a paid product and for team features. Needs an account, a hosting
  choice and a privacy review. Not possible without an owner decision on the
  backend.
- **C. No model, retrieval only.** Pure search with citations. Always
  available as the fallback and the base layer of both options.

## What changes if we accept A
Agents build `docs/ai.js` with a provider interface, retrieval over the law
and the firm's register, personal-data redaction, a citation verifier and
golden evals. Retrieval-only mode (C) works with no key. Option B later swaps
the provider behind the same interface.

## Evidence
To be filled in by the build session from the provider's official
documentation (browser access rules, data-retention and training terms).
No cost or performance numbers are assumed here.
