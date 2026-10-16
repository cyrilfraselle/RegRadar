# AI evals

Offline, dependency-free checks for `docs/ai.js` (Node 18+). From `tests/`:

    node evals/retrieval.mjs   # recall@5 over golden.json, plus passage integrity
    node evals/verify.mjs      # citation verifier, redaction, prompt, providers (mocked fetch), store

Both exit non-zero on failure, so CI can run them as is.

## Retrieval eval

`golden.json` has 45 English questions over AMLR, TFR, AMLD6, AMLAR, DORA, MiCA, PSD2 and GDPR. Each lists the
article(s) that must appear among the **top 5 retrieved articles** (one result per article, best passage shown).
Every expected article carries an `evidence` regex that must match the article text in `docs/data/laws`, checked on
every run, so the set cannot drift from the law JSON.

Questions are tagged `dev` (used while tuning the abbreviation expansions in `ai.js`) or `holdout` (written first,
measured, not tuned on). Read the holdout number as the honest one.

Measured on the core scope (9 instruments, 2025 passages):

| split | recall@5 |
|---|---|
| all | 95.7% (44/46 expected articles) |
| dev | 100% (26/26) |
| holdout | 90.0% (18/20) |

The two holdout misses are kept as known misses: GDPR Art. 44 (transfers, ranked below Arts. 45-49) and AMLD6 Art. 21
(FIU access to information). Gates: overall >= 0.90, holdout >= 0.85 (set a little under the measured values).
A change to the tokenizer, ranking or expansions that lowers recall below the gate fails the run. Raise the gate
only after a measured improvement; never lower it to make a change pass.

## Citation verifier tests

`verify.mjs` covers true and false cases: verbatim quotes (whitespace, curly quotes, non-breaking space and hyphen
variants), altered quotes, a quote taken from the wrong source, a citation to a non-existent source, an uncited quote,
`[...]` fragments in order, answers with no quotes (never "checked"), abstentions, and grouped `[S1, S2]` citations.
It also runs the Anthropic and OpenAI-compatible providers against mocked `fetch` (request shape, streamed text,
thinking blocks ignored, HTTP 401, mid-stream error, network error). The live call is not covered.

## Not covered

Citation faithfulness against real model output (needs a key, so not in CI), answer quality, French and Dutch.
Add model-in-the-loop evals later behind an opt-in flag with the key read from the environment.
