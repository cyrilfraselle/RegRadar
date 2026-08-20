# Upload to GitHub — instructions for the Cowork session

Paste the block below into Cowork, with the unzipped folder attached or open.

---

## Prompt for Cowork

> Add these files to my **RegRadar** repo, in the `docs/` folder, on `main`.
>
> **New files:**
> - `docs/casefile.html`
> - `docs/data/academy/investigations.json`
>
> **Replace existing:**
> - `docs/academy.html`
> - `docs/shift.html`
> - `docs/triage.html`
> - `docs/data/academy/triage-cases.json`
>
> Then, in every other page in `docs/` that has a `<nav class="nav">` block —
> `index.html`, `law.html`, `country-risk.html`, `obligations.html`,
> `extractor.html`, `ubo.html`, `map.html`, `laundromat.html` — add this line
> inside the nav, after the last existing link:
>
> ```html
> <a href="casefile.html">Casefile</a>
> ```
>
> Do not overwrite those pages wholesale; only insert that one line, so nothing
> else on them changes.
>
> Commit message: `Academy: add The Casefile investigation module`
>
> Then confirm the commit went to `main` and tell me the commit URL.

---

## Check it worked

Wait about a minute for Pages to rebuild, then open with a hard refresh
(`Cmd+Shift+R`):

- `…/RegRadar/casefile.html` — should show four cases, three locked
- `…/RegRadar/data/academy/investigations.json` — should download, not 404

If the case list says **"The desk is empty"**, the JSON did not land. The page
looks in `data/academy/` first and then beside itself, so putting
`investigations.json` next to `casefile.html` also works.

## If Cowork cannot reach the repo

Fall back to the GitHub web interface: repo → `docs` → **Add file → Upload
files** → drag → **Commit changes**. Note the web uploader does not preserve
folders, so drop `investigations.json` at the same level as `casefile.html`
rather than trying to recreate `data/academy/`.
