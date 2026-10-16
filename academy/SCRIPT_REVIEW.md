# Script review gate for Academy videos

No video is built before its script has passed this gate. The gate exists
because a polished film makes a mistake look authoritative.

1. **Brief**: topic, audience (new analyst at a payment, e-money or crypto
   firm), one message, length (30 to 90 s), and the typology or situation the
   film shows. Always say it is ONE example, and name it.
2. **Script and claim ledger**: write the script as numbered claims. For each
   claim record: the exact wording, the source (article of
   `docs/data/laws/*.json`, or a named official guidance document), and a
   verdict. Stored next to the film as `FACTCHECK.md`.
3. **Independent check**: a reviewer that did not write the script checks
   every claim against its source. Law claims must match the text word for
   word where quoted, and in meaning where paraphrased. Anything that is a
   teaching model or a typology (not law) is worded as "commonly", "one
   example" or "a teaching model", never as a rule.
4. **Approximation rules**: no numbers, thresholds or statistics without a
   source; no "always" or "never" unless the text says so; do not map one
   control to one stage when the duty is continuous; say "natural person"
   where the law does; dates come from the law text (for example AMLR Art. 90).
5. **Owner sign-off** on the ledger summary, then build.
6. **After build**: re-read captions and transcript against the ledger (the
   words on screen are the words that were checked).
7. **Changes**: if the law text changes, the film's ledger is re-run and the
   film is marked "needs review" until it passes.

Reference example: `docs/labs/010-follow-the-money/FACTCHECK.md`.
