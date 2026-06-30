# RegRadar — EU & Belgian Regulatory Intelligence

Automated regulatory watch for financial-services compliance teams (Belgium + EU).
Collects regulator publications and news, scores them by impact, enriches them with
AI summaries, and publishes a daily dashboard.

## Structure

```
RegRadar/
├── regulatory_watch.py     ← main engine (run this)
├── classification_v3.py    ← scoring + source classification
├── enrichment_v3.py        ← Groq AI summaries + trends
├── intelligence_v4.py      ← thematic briefing + key-dates timeline
├── dashboard_data.py       ← exports JSON for the website
├── requirements.txt        ← Python dependencies
├── docs/                   ← the website (served by GitHub Pages)
│   ├── index.html          ← the dashboard
│   └── data/               ← items.json + meta.json (the data layer)
└── .gitignore              ← keeps secrets & local files off GitHub
```

## Run the engine locally

```
pip install -r requirements.txt
python regulatory_watch.py --maintenant
```

This refreshes `docs/data/items.json` and `docs/data/meta.json`,
which the dashboard reads.

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
