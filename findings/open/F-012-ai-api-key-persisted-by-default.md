---
id: F-012
title: Ask the law stores the user's model API key in localStorage permanently, with no "this session only" option
area: shared
severity: P2
risk: medium
status: open
effort: S
files:
  - docs/ai.js
  - docs/ask.html
found: 2026-10-26
fixed_by:
---

## Evidence
`docs/ai.js:831`: `setKey` always writes `storage.setItem(K.key(provider), key)` to the `localStorage` passed in at `docs/ask.html:238` (`AI.createStore(window.localStorage)`). The consent text (`ai.js:46`) admits that "anyone with access to this browser profile or to the page code running here could read it". No page in `docs/` sets a Content-Security-Policy (`grep -l Content-Security-Policy docs/*.html` is empty), and the same origin also hosts pages that load `docs/vendor/*.min.js` and inline scripts. A key typed once therefore stays until the user finds "Forget key".

## Why it matters
Compliance officers use shared or managed laptops. A persistent, billable credential in plain storage is the most sensitive item the static app ever holds, and the safer default (key lives for the tab only) costs one extra paste.

## Proposed fix
Default to `sessionStorage` for the key. Add an unticked checkbox "Remember on this device" beside the key field that, when ticked, uses `localStorage`. Keep the "Forget key" button clearing both. Update the consent point at `ai.js:46` to say which one applies. Existing saved keys keep working (read both, prefer session).

## How to verify
Enter a key without ticking the box, reload: key field is empty in a new tab but present after reload in the same tab. With the box ticked it survives a new tab. "Forget key" clears both stores. Node check of `createStore` with a fake storage pair.
