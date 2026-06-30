# ═══════════════════════════════════════════════════════════════
#  CONFIG — MODÈLE (sans secrets)
# ═══════════════════════════════════════════════════════════════
#
#  COMMENT UTILISER :
#  1. Copie ce fichier et renomme la copie en  "config.py"
#  2. Remplis tes vraies valeurs dans config.py
#  3. config.py ne sera JAMAIS poussé sur GitHub (il est dans .gitignore)
#
#  Ce fichier-ci (config.example.py) ne contient AUCUN secret et peut
#  donc rester public sans risque.
# ═══════════════════════════════════════════════════════════════

# ── Email (Gmail) ────────────────────────────────────────────────
EMAIL_SENDER = "ton.email@gmail.com"
EMAIL_APP_PASSWORD = "xxxx xxxx xxxx xxxx"   # mot de passe d'application Gmail (16 caractères)
EMAIL_RECIPIENTS = ["ton.email@gmail.com"]
EMAIL_SEND_TIME = "08:00"
EMAIL_SEND_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"]

# ── Groq AI (gratuit) ────────────────────────────────────────────
# Clé gratuite sur https://console.groq.com (commence par "gsk_")
GROQ_API_KEY = ""    # laisse vide pour désactiver l'IA

# ── Google Sheets (optionnel) ────────────────────────────────────
GSHEET_ID = ""                               # ID dans l'URL du Sheet ; vide = désactivé
GSHEET_CREDENTIALS_FILE = "credentials.json"
GSHEET_TAB = "Veille Réglementaire"

# ── Claude API (optionnel, non utilisé par défaut) ───────────────
CLAUDE_API_KEY = ""
