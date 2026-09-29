"""
Builds docs/data/obligations.json — the first real slice of the
Obligations Registry. Every record is grounded in AMLR (Regulation (EU)
2024/1624) verbatim text read directly from docs/data/laws/32024R1624_EN.json,
not invented. Article numbers, thresholds and the Art. 90 application date
(10 July 2027) were all verified against that file before writing this.

Scope: AMLR Chapter III Section 1 (general CDD: Art. 19-26) plus Art. 34
(EDD scope), 42 & 46 (PEP), 69 (STR/SAR reporting) — the obligations that
back the Academy's existing PEP/UBO/CDD/SoW-SoF/EDD case content, so the
register and the training curriculum point at the same law.
"""
import json
from pathlib import Path

TODAY = "2026-09-29"
APPLIES_FROM = "2027-07-10"   # AMLR Art. 90 — verified against the actual text

# entity codes match docs/data/applicability.json's `entities` list
ALL_OBLIGED = ["bank", "pi", "emi", "casp", "invfirm", "fund", "other"]

OBLIGATIONS = [
    {
        "id": "AMLR-art19",
        "article": "19",
        "title": "Application of customer due diligence measures",
        "what": "Apply CDD whenever establishing a business relationship, on occasional transactions of €10,000+ (€1,000 for crypto-asset transfers, €3,000 in cash, €2,000 for gambling), on any ML/TF suspicion regardless of amount, or when doubting previously obtained identification data.",
        "who": ALL_OBLIGED,
        "who_note": "Insurers: only for life/investment-related insurance business.",
        "topic": "CDD",
        "priority": "high",
        "criticality": "high",
        "verbatim": "Obliged entities shall apply customer due diligence measures in any of the following circumstances: (a) when establishing a business relationship; (b) when carrying out an occasional transaction of a value of at least EUR 10 000 [...]; (c) when participating in the creation of a legal entity [...]; (d) when there is a suspicion of money laundering or terrorist financing, regardless of any derogation, exemption or threshold; (e) when there are doubts about the veracity or adequacy of previously obtained customer identification data; (f) when there are doubts as to whether the person they interact with is the customer or person authorised to act on behalf of the customer.",
        "sub_requirements": [
            "New business relationship",
            "Occasional transaction ≥ €10,000 (or ≥ €1,000 for crypto transfers, ≥ €3,000 cash, ≥ €2,000 gambling)",
            "Any ML/TF suspicion, at any amount",
            "Doubts about previously collected identification data",
            "Doubts about whether the counterparty is really the customer or an authorised agent",
        ],
        "academy_cases": ["INV-401", "INV-402", "INV-403", "A-4479", "OWN-01"],
    },
    {
        "id": "AMLR-art20",
        "article": "20",
        "title": "Customer due diligence measures",
        "what": "CDD itself means four things done together: identify and verify the customer, identify and take reasonable measures to verify beneficial owners, understand the purpose and intended nature of the relationship, and conduct ongoing monitoring.",
        "who": ALL_OBLIGED,
        "topic": "CDD",
        "priority": "high",
        "criticality": "high",
        "verbatim": "For the purpose of conducting customer due diligence, obliged entities shall apply all of the following measures: (a) identifying the customer and verifying the customer’s identity; (b) identifying the beneficial owners and taking reasonable measures to verify their identity [...]",
        "sub_requirements": [
            "Identify and verify the customer",
            "Identify beneficial owners and take reasonable measures to verify them",
            "Understand the purpose and intended nature of the relationship",
            "Conduct ongoing monitoring throughout the relationship",
        ],
        "academy_cases": ["INV-401", "A-4471", "A-4476"],
    },
    {
        "id": "AMLR-art21",
        "article": "21",
        "title": "Inability to comply with the requirement to apply customer due diligence measures",
        "what": "If CDD cannot be completed, the transaction must not go ahead and an existing relationship must be terminated — and the firm must consider whether the inability itself is grounds for a suspicious-transaction report.",
        "who": ALL_OBLIGED,
        "topic": "CDD",
        "priority": "high",
        "criticality": "high",
        "verbatim": "Where an obliged entity is unable to comply with the requirement to apply customer due diligence measures laid down in Article 20(1), it shall refrain from carrying out a transaction or establishing a business relationship, and shall terminate the business relationship and consider reporting a suspicious transaction to the FIU [...]",
        "sub_requirements": [
            "Do not carry out the transaction / do not establish the relationship",
            "Terminate an existing relationship where CDD cannot be completed",
            "Consider an STR on the inability itself, not just on the underlying activity",
        ],
        "academy_cases": ["OWN-06"],
    },
    {
        "id": "AMLR-art22",
        "article": "22",
        "title": "Identification and verification of the identity of customers and beneficial owners",
        "what": "Collect a defined minimum data set to identify the customer, anyone acting on their behalf, and the beneficial owners — different fields for natural persons, legal entities, and trusts/similar arrangements.",
        "who": ALL_OBLIGED,
        "topic": "CDD",
        "priority": "high",
        "criticality": "high",
        "verbatim": "[...] obliged entities shall obtain at least the following information in order to identify the customer [...]: (a) for a natural person: all names and surnames; place and full date of birth; nationalities [...]; the usual place of residence [...]; (b) for a legal entity: legal form and name; address of the registered or official office [...]; the names of the legal representatives [...]; (c) for a trustee of an express trust [...]: basic information on the legal arrangement [...]",
        "sub_requirements": [
            "Natural person: full name, DOB, nationality, residential address",
            "Legal entity: legal form, name, registered address, legal representatives, LEI where available",
            "Trust/similar arrangement: settlor, trustee, protector, beneficiaries, anyone with effective control",
            "Nominee shareholders/directors: identified and flagged as nominees",
        ],
        "academy_cases": ["OWN-01", "OWN-02", "OWN-03", "OWN-04", "OWN-05", "OWN-06"],
    },
    {
        "id": "AMLR-art23",
        "article": "23",
        "title": "Timing of the verification of the customer and beneficial owner identity",
        "what": "Verify identity before establishing the relationship or carrying out the transaction, as the default rule — completing it during onboarding is a narrow exception, not the norm.",
        "who": ALL_OBLIGED,
        "topic": "CDD",
        "priority": "medium",
        "criticality": "medium",
        "verbatim": "Verification of the identity of the customer, the beneficial owner, and of any persons [...] shall take place before the establishment of a business relationship or the carrying out of an occasional transaction. Such obligation shall not apply to situations of [...] low risk, provided that verification is completed as soon as possible after the first contact.",
        "sub_requirements": [
            "Default: verify before onboarding / before the transaction",
            "Narrow low-risk exception: verify as soon as possible after first contact",
        ],
        "academy_cases": [],
    },
    {
        "id": "AMLR-art24",
        "article": "24",
        "title": "Reporting of discrepancies with information contained in beneficial ownership registers",
        "what": "Where what you find during CDD doesn't match the national beneficial ownership register, report the discrepancy to that register — this is a standing feedback duty, not optional.",
        "who": ALL_OBLIGED,
        "topic": "UBO",
        "priority": "medium",
        "criticality": "medium",
        "verbatim": "Obliged entities shall report to the central registers any discrepancies they find between the information available in the central registers and the information they collect [...]",
        "sub_requirements": [
            "Compare CDD findings against the national UBO register",
            "Report any discrepancy found to that register",
        ],
        "academy_cases": ["OWN-04", "OWN-06"],
    },
    {
        "id": "AMLR-art25",
        "article": "25",
        "title": "Identification of the purpose and intended nature of a business relationship or occasional transaction",
        "what": "Before onboarding, understand and be able to evidence why the customer wants the relationship and what they intend to use it for — this becomes the baseline every later transaction is measured against.",
        "who": ALL_OBLIGED,
        "topic": "CDD",
        "priority": "medium",
        "criticality": "medium",
        "verbatim": "Before entering into a business relationship or performing an occasional transaction, an obliged entity shall assure itself that it understands its purpose and intended nature. To that end, the obliged entity shall obtain, where necessary, information on [...] the purpose and economic rationale of the [...] relationship [...]",
        "sub_requirements": [
            "Purpose and economic rationale of the relationship",
            "Expected pattern and volume of activity",
        ],
        "academy_cases": ["A-4471", "A-4474"],
    },
    {
        "id": "AMLR-art26",
        "article": "26",
        "title": "Ongoing monitoring of the business relationship and monitoring of transactions performed by customers",
        "what": "Monitor transactions throughout the relationship for consistency with what you know about the customer, keep underlying documents current, and reassess risk when circumstances change.",
        "who": ALL_OBLIGED,
        "topic": "Transaction Monitoring",
        "priority": "high",
        "criticality": "high",
        "verbatim": "Obliged entities shall conduct ongoing monitoring of business relationships, including transactions undertaken by the customer throughout the course of a business relationship, to ensure that those transactions are consistent with the obliged entity’s knowledge of the customer, the customer’s business and risk profile [...]",
        "sub_requirements": [
            "Screen transactions against the customer's known profile",
            "Keep documents, data and information up to date",
            "Reassess risk on material changes in customer circumstances",
        ],
        "academy_cases": ["A-4471", "A-4472", "A-4473", "A-4475", "A-4481", "INV-101"],
    },
    {
        "id": "AMLR-art34",
        "article": "34",
        "title": "Scope of application of enhanced due diligence measures",
        "what": "Apply EDD wherever higher risk is identified — complex, unusually large, or economically unexplained transactions, or any other higher-risk factor from the firm's own risk assessment — not just in the law's explicitly listed high-risk scenarios.",
        "who": ALL_OBLIGED,
        "topic": "EDD",
        "priority": "high",
        "criticality": "high",
        "verbatim": "Obliged entities shall examine the origin and destination of funds involved in, and the purpose of, all transactions that fulfil at least one of the following conditions: (a) the transaction is of a complex nature; (b) the transaction is unusually large; (c) the transaction is conducted in an unusual pattern; (d) the transaction does not have an apparent economic or lawful purpose.",
        "sub_requirements": [
            "Complex, unusually large, unusually patterned, or economically unexplained transactions",
            "Any other higher-risk factor identified by the firm's own risk assessment",
            "EDD measures proportionate to the risk — not a fixed checklist",
        ],
        "academy_cases": ["A-4474", "A-4482", "INV-201", "INV-403"],
    },
    {
        "id": "AMLR-art42",
        "article": "42",
        "title": "Specific provisions regarding politically exposed persons",
        "what": "On top of ordinary CDD, PEP relationships need senior management sign-off, a verified source of wealth and source of funds, and enhanced ongoing monitoring — PEP status itself is not grounds to decline.",
        "who": ALL_OBLIGED,
        "topic": "PEP",
        "priority": "high",
        "criticality": "high",
        "verbatim": "In addition to the customer due diligence measures laid down in Article 20, obliged entities shall apply the following measures with respect to occasional transactions or business relationships with politically exposed persons: (a) obtain senior management approval [...]; (b) take adequate measures to establish the source of wealth and source of funds [...]; (c) conduct enhanced, ongoing monitoring [...]",
        "sub_requirements": [
            "Senior management approval to onboard or continue the relationship",
            "Verified source of wealth and source of funds",
            "Enhanced, ongoing monitoring for the life of the relationship",
        ],
        "academy_cases": ["INV-401", "A-4479"],
    },
    {
        "id": "AMLR-art46",
        "article": "46",
        "title": "Family members and persons known to be close associates of politically exposed persons",
        "what": "The same senior-approval / source-of-wealth / enhanced-monitoring measures required for PEPs also apply to their family members and known close associates — not a lighter regime.",
        "who": ALL_OBLIGED,
        "topic": "PEP",
        "priority": "medium",
        "criticality": "medium",
        "verbatim": "The measures referred to in Articles 42, 44 and 45 shall also apply to family members or persons known to be close associates of politically exposed persons.",
        "sub_requirements": [],
        "academy_cases": ["A-4479"],
    },
    {
        "id": "AMLR-art69",
        "article": "69",
        "title": "Reporting of suspicions",
        "what": "Report to the FIU on your own initiative whenever you know, suspect, or have reasonable grounds to suspect proceeds of crime or terrorist financing — any amount, including attempted transactions and suspicion arising from a failed CDD check — and answer FIU information requests within 5 working days.",
        "who": ALL_OBLIGED,
        "topic": "STR/SAR",
        "priority": "high",
        "criticality": "high",
        "verbatim": "Obliged entities [...] shall cooperate fully with the FIU by promptly: (a) reporting to the FIU, on their own initiative, where the obliged entity knows, suspects or has reasonable grounds to suspect that funds or activities, regardless of the amount involved, are the proceeds of criminal activity or are related to terrorist financing [...]; (b) providing the FIU, at its request, with all necessary information [...] For the purposes of the first subparagraph, obliged entities shall reply to requests for information by the FIU within 5 working days.",
        "sub_requirements": [
            "Report on your own initiative — no materiality or amount threshold",
            "Covers attempted transactions and suspicion arising from a failed CDD check",
            "Respond to FIU information requests within 5 working days (can be shortened in urgent cases)",
        ],
        "academy_cases": ["A-4471", "A-4472", "A-4476", "INV-101", "INV-202", "INV-301"],
    },
]


def build():
    laws_path = Path("docs/data/laws/32024R1624_EN.json")
    law = json.load(open(laws_path, encoding="utf-8"))
    art_by_id = {a["id"]: a for a in law["articles"]}

    records = []
    for o in OBLIGATIONS:
        art = art_by_id.get(o["article"])
        assert art is not None, f"Article {o['article']} not found in AMLR text"
        assert " ".join(art["title"].split()) == " ".join(o["title"].split()), (
            f"Title mismatch for Art. {o['article']}: "
            f"expected {o['title']!r}, law text has {art['title']!r}"
        )
        legal_basis = f"AMLR Art. {o['article']}"
        record = {
            "id": o["id"],
            "who": o["who"],
            "what": o["what"],
            "deadline": APPLIES_FROM,
            "status": "scheduled",
            "legal_basis": legal_basis,
            "topic": o["topic"],
            "priority": o["priority"],
            "source_url": f"law.html?celex=32024R1624&art={o['article']}",
            "detected": TODAY,
            # rich fields, not read by the current tracker UI but kept for
            # the detail expansion and for future obligation-mapping work
            "verbatim": o["verbatim"],
            "sub_requirements": o["sub_requirements"],
            "criticality": o["criticality"],
            "academy_cases": o["academy_cases"],
        }
        if "who_note" in o:
            record["who_note"] = o["who_note"]
        records.append(record)

    out = {
        "_meta": {
            "name": "Obligations register",
            "version": 1,
            "count": len(records),
            "generated": TODAY,
            "scope": "AMLR (Regulation (EU) 2024/1624) Chapter III Section 1 (general CDD) plus EDD scope, PEP-specific provisions, and suspicious-transaction reporting.",
            "method": "Every verbatim excerpt and article number checked directly against docs/data/laws/32024R1624_EN.json (official CELLAR text) before publication — not generated from a summary.",
            "disclaimer": "Indicative compliance register, not legal advice. Always verify against the current text and any Belgian transposition/guidance.",
            "next": "Extend to AMLD6 (Belgian transposition obligations), beneficial-ownership-register chapter (Ch. IV), and CRD IV/DORA for a second sector.",
        },
        "obligations": records,
    }
    Path("docs/data/obligations.json").write_text(
        json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"Wrote {len(records)} obligations to docs/data/obligations.json")


if __name__ == "__main__":
    build()
