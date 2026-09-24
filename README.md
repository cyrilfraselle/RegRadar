# RegRadar — EU & Belgian Regulatory Intelligence

**Live site: https://cyrilfraselle.github.io/RegRadar/** · prototype, not legal advice.

Tools for financial-services compliance teams in Belgium and the EU:

- **RegWatch** — a daily regulatory watch. Collects publications from the
  NBB, FSMA, EBA, ECB (incl. Banking Supervision), ESMA, EIOPA, AMLA, SRB,
  FSB, the European Commission and EUR-Lex, reads each publication's own
  page or PDF, classifies it (instrument type, legal weight, topic) and
  adds an AI summary. A profile ("I am a bank…") filters it to what applies.
- **Read the Law** — key EU regulations (AMLR, DORA, MiCA, CRR…) in a clean reader.
- **Country Risk** — a configurable country-risk model.
- **Academy** — AML/KYC training in a simulated bank (CF Bank, fictional):
  a full analyst workstation plus practice modules (Laundromat, Ownership, The Desk).

## Structure

```
RegRadar/
├── regulatory_watch.py     ← main engine (run daily by GitHub Actions)
├── classification_v3.py    ← relevance, instrument type, legal weight
├── page_reader.py          ← reads each publication's page or PDF
├── enrichment_v3.py        ← Groq AI summaries + trends
├── intelligence_v4.py      ← thematic briefing + key-dates timeline
├── dashboard_data.py       ← exports JSON for the website
├── requirements.txt        ← Python dependencies
├── .github/workflows/      ← daily watch (06:00 UTC) + law parsing
└── docs/                   ← the website (GitHub Pages)
    ├── regwatch.html, law.html, country-risk.html, academy.html, …
    ├── site-nav.js         ← the shared menu + footer, used by every page
    └── data/               ← items.json + meta.json (the data layer)
```

## Run the engine locally

```
pip install -r requirements.txt
python regulatory_watch.py --maintenant
```

This refreshes `docs/data/items.json` and `docs/data/meta.json`,
which RegWatch reads.

## Notes
- Secrets (credentials.json, config.py, API keys) are git-ignored — never committed.
- Confidential documents must stay local — never push them to GitHub.


## ⚠️ Configuration des secrets (IMPORTANT)

Les secrets (mot de passe Gmail, clé Groq, ID Sheet) ne sont PAS dans le code.
Ils vivent dans un fichier `config.py` local, ignoré par git.

**Pour configurer :**
1. Copie `config.example.py` en `config.py`
2. Remplis tes vraies valeurs dans `config.py`
3. Ne pousse JAMAIS `config.py` sur GitHub (déjà protégé par .gitignore)
