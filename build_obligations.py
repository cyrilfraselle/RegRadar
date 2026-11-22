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
        "id": "AMLR-art8",
        "article": "8",
        "title": "Notification of cross-border operations and application of national law",
        "what": "Notify your home supervisor as soon as you take steps to start activities in another Member State (for establishments at least 3 months before starting), and again immediately when you start; notify planned changes at least 1 month ahead; comply with the national rules of the Member State where you are established (Art. 8(3)) and apply the rules of the Member State where each establishment is located.",
        "who": ALL_OBLIGED,
        "who_note": "Does not apply where other Union acts already set a notification or authorisation procedure (Art. 8(1), second subparagraph): check your passporting route first.",
        "topic": "Governance",
        "priority": "medium",
        "criticality": "medium",
        "verbatim": "Obliged entities wishing to carry out activities within the territory of another Member State for the first time shall notify the supervisors of their home Member State of the activities which they intend to carry out in that other Member State. [...] Any planned change to the information communicated under paragraph 1 shall be communicated by the obliged entity to the supervisor of the home Member State at least 1 month before making the change. [...] Where obliged entities operate establishments in several Member States, they shall ensure that each establishment applies the rules of the Member State in which it is located.",
        "sub_requirements": [
            "Notify the home supervisor before first activity in another Member State (establishments: at least 3 months before)",
            "Notify the home supervisor immediately on commencement",
            "Communicate planned changes at least 1 month before",
            "Each establishment applies the rules of the Member State where it is located",
        ],
        "academy_cases": [],
    },
    {
        "id": "AMLR-art9",
        "article": "9",
        "title": "Scope of internal policies, procedures and controls",
        "what": "Have written internal policies, procedures and controls proportionate to the business, covering the listed topics (risk assessment, CDD, reporting, outsourcing, record keeping, training and others), approved by the management body in its management function (policies) and at least the compliance manager (procedures and controls), tested by an independent audit function and kept up to date.",
        "who": ALL_OBLIGED,
        "topic": "Governance",
        "priority": "high",
        "criticality": "high",
        "verbatim": "Obliged entities shall have in place internal policies, procedures and controls in order to ensure compliance with this Regulation, Regulation (EU) 2023/1113 and any administrative act issued by any supervisor [...]. The policies, procedures and controls referred to in the first subparagraph shall be proportionate to the nature of the business, including its risks and complexity, and the size of the obliged entity and shall cover all the activities of the obliged entity that fall under the scope of this Regulation. [...] The internal policies, procedures and controls set out in the first subparagraph shall be recorded in writing. Internal policies shall be approved by the management body in its management function. Internal procedures and controls shall be approved at least at the level of the compliance manager. [...] The obliged entities shall keep the internal policies, procedures and controls up-to-date, and enhance them where weaknesses are identified.",
        "sub_requirements": [
            "Policies and procedures cover at least the ten topics of Art. 9(2)(a)(i) to (x)",
            "Internal controls and an independent audit function test them (external expert if no audit function)",
            "Recorded in writing; policies approved by the management body, procedures and controls at least by the compliance manager",
            "Kept up to date and strengthened where weaknesses are found",
        ],
        "academy_cases": [],
    },
    {
        "id": "AMLR-art10",
        "article": "10",
        "title": "Business-wide risk assessment",
        "what": "Identify and assess the money laundering and terrorist financing risks of the whole business, and the risks of non-implementation and evasion of targeted financial sanctions, using at least the listed sources; document it, keep it up to date, drawn up by the compliance officer and approved by the management body. New products, channels, technologies, segments or geographies are assessed before launch.",
        "who": ALL_OBLIGED,
        "who_note": "Supervisors may decide that an individual documented assessment is not required for some sectors where the sector's risks are clear and understood, but not for credit institutions, financial institutions, crowdfunding service providers or crowdfunding intermediaries (Art. 10(3)).",
        "topic": "Governance",
        "priority": "high",
        "criticality": "high",
        "verbatim": "Obliged entities shall take appropriate measures, proportionate to the nature of their business, including its risks and complexity, and their size, to identify and assess the risks of money laundering and terrorist financing to which they are exposed, as well as the risks of non-implementation and evasion of targeted financial sanctions [...]. Prior to the launch of new products, services or business practices, including the use of new delivery channels and new or developing technologies [...] obliged entities shall identify and assess, in particular, the related money laundering and terrorist financing risks and take appropriate measures to manage and mitigate those risks. [...] The business-wide risk assessment drawn up by the obliged entity pursuant to paragraph 1 shall be documented, kept up-to-date and regularly reviewed [...]. It shall be made available to supervisors upon request. The business-wide risk assessment shall be drawn up by the compliance officer and approved by the management body in its management function [...].",
        "sub_requirements": [
            "Take into account at least risk variables and factors (Annexes I to III), EU and national risk assessments, standard-setter and AMLA publications, authority information and the customer base",
            "Assess risks before launching new products, channels, technologies, segments or geographies",
            "Document, keep up to date, review when events significantly change the risks",
            "Drawn up by the compliance officer, approved by the management body; available to supervisors on request",
        ],
        "academy_cases": [],
    },
    {
        "id": "AMLR-art11",
        "article": "11",
        "title": "Compliance functions",
        "what": "Appoint a compliance manager from the management body and a compliance officer with sufficient standing, give them resources and powers, protect the officer from retaliation, allow direct reporting to the management body, and report on implementation at least once a year.",
        "who": ALL_OBLIGED,
        "topic": "Governance",
        "priority": "high",
        "criticality": "high",
        "verbatim": "Obliged entities shall appoint one member of the management body in its management function who shall be responsible for ensuring compliance with this Regulation, Regulation (EU) 2023/1113 and any administrative act issued by any supervisor (\u2018compliance manager\u2019). [...] Obliged entities shall have a compliance officer, to be appointed by the management body in its management function and with sufficiently high hierarchical standing, who shall be responsible for the policies, procedures and controls in the day-to-day operation of the obliged entity\u2019s AML/CFT requirements [...]. Obliged entities shall provide the compliance functions with adequate resources, including staff and technology, in proportion to the size, nature and risks of the obliged entity for effective performance of their tasks [...]. In particular, the compliance manager shall submit once a year, or, where appropriate, more frequently, to the management body a report on the implementation of the obliged entity\u2019s internal policies, procedures and controls drawn up by the compliance officer [...].",
        "sub_requirements": [
            "Compliance manager: one member of the management body, responsible for compliance",
            "Compliance officer: appointed by the management body, day-to-day responsibility, contact point for authorities, reports suspicions to the FIU",
            "Adequate resources (staff and technology) and powers to propose measures",
            "Officer protected from retaliation; officer and audit lead can report directly to the management body",
            "Annual (or more frequent) report to the management body, with timely remedy of deficiencies",
            "Removal of the officer: prior notification to the management body and notification to the supervisor",
        ],
        "academy_cases": [],
    },
    {
        "id": "AMLR-art12",
        "article": "12",
        "title": "Awareness of requirements",
        "what": "Make sure staff, agents and distributors whose role requires it know the rules and the firm's risk assessment and policies, including on the processing of personal data for AML/CFT purposes, through ongoing, documented training suited to their functions and the firm's risks.",
        "who": ALL_OBLIGED,
        "topic": "Training",
        "priority": "medium",
        "criticality": "medium",
        "verbatim": "Obliged entities shall take measures to ensure that their employees or persons in comparable positions whose function so requires, including their agents and distributors are aware of the requirements arising from this Regulation [...] and of the business-wide risk assessment, internal policies, procedures and controls in place in the obliged entity [...]. The measures referred to in the first paragraph shall include the participation of employees or persons in comparable positions, including agents and distributors, in specific, ongoing training programmes to help them recognise operations which may be related to money laundering or terrorist financing and to instruct them as to how to proceed in such cases. Such training programmes shall be appropriate to their functions or activities and to the risks of money laundering and terrorist financing to which the obliged entity is exposed, and shall be duly documented.",
        "sub_requirements": [
            "Staff, agents and distributors whose function requires it are aware of the rules, the risk assessment and the policies",
            "Specific, ongoing training to recognise suspicious operations and know what to do",
            "Training appropriate to function and to the firm's risks",
            "Training duly documented",
        ],
        "academy_cases": [],
    },
    {
        "id": "AMLR-art13",
        "article": "13",
        "title": "Integrity of employees",
        "what": "Assess staff, agents and distributors who take part in AML/CFT compliance for skills and good repute before they start and regularly after, require them to declare close relationships with customers, and have procedures to manage conflicts of interest.",
        "who": ALL_OBLIGED,
        "who_note": "Art. 13(4) disapplies the article for a natural person, or a legal person whose activities are performed by one natural person only.",
        "topic": "Governance",
        "priority": "medium",
        "criticality": "medium",
        "verbatim": "Any employee, or person in a comparable position, including agents and distributors, directly participating in the obliged entity\u2019s compliance with this Regulation [...] shall undergo an assessment commensurate with the risks associated with the tasks performed and whose content is approved by the compliance officer of: (a) individual skills, knowledge and expertise to carry out their functions effectively; (b) good repute, honesty and integrity. The assessment referred to in the first subparagraph shall be performed prior to taking up of activities [...] and shall be regularly repeated. [...] Obliged entities shall have in place procedures to prevent and manage conflicts of interest that may affect the carrying out of tasks related to the obliged entity\u2019s compliance with this Regulation [...].",
        "sub_requirements": [
            "Assess skills, knowledge, expertise, good repute, honesty and integrity, content approved by the compliance officer",
            "Assessment before taking up activities and repeated regularly, with intensity based on the role",
            "Staff declare close private or professional relationships with customers and are kept off those customers' compliance tasks",
            "Procedures to prevent and manage conflicts of interest",
        ],
        "academy_cases": [],
    },
    {
        "id": "AMLR-art14",
        "article": "14",
        "title": "Reporting of breaches and protection of reporting persons",
        "what": "Set up internal reporting channels that meet the EU Whistleblower Directive for breaches of the AMLR and related acts (Art. 14(3) exempts a natural person, or a legal person whose activities are performed by one natural person only, from the internal-channel duty).",
        "who": ALL_OBLIGED,
        "who_note": "Art. 14(3): the internal-channel duty does not apply to a natural person, or a legal person whose activities are performed by one natural person only.",
        "topic": "Governance",
        "priority": "medium",
        "criticality": "medium",
        "verbatim": "Directive (EU) 2019/1937 of the European Parliament and of the Council [...] shall apply to the reporting of breaches of this Regulation, Regulation (EU) 2023/1113 and any administrative act issued by any supervisor, and to the protection of persons reporting such breaches. [...] Obliged entities shall establish internal reporting channels that meet the requirements set out in Directive (EU) 2019/1937.",
        "sub_requirements": [
            "Whistleblower Directive (EU) 2019/1937 applies to reports of AMLR breaches",
            "Internal reporting channels meeting that Directive's requirements",
        ],
        "academy_cases": [],
    },
    {
        "id": "AMLR-art16",
        "article": "16",
        "title": "Group-wide requirements",
        "what": "A parent undertaking must apply the internal procedures, risk assessment and staff requirements in all branches and subsidiaries of the group in the Member States and, for groups whose head office is located in the Union, in third countries, run a group-wide risk assessment and policies, set up group-level compliance functions, and require information sharing within the group for CDD and risk management.",
        "who": ALL_OBLIGED,
        "who_note": "Only relevant to groups: the duty sits on the parent undertaking (Art. 16(1)) and is applied across the group's branches and subsidiaries.",
        "topic": "Governance",
        "priority": "medium",
        "criticality": "medium",
        "verbatim": "A parent undertaking shall ensure that the requirements on internal procedures, risk assessment and staff referred to in Section 1 of this Chapter apply in all branches and subsidiaries of the group [...]. To this end, a parent undertaking shall perform a group-wide risk assessment, taking into account the business-wide risk assessment performed by all branches and subsidiaries of the group, and establish and implement group-wide policies, procedures and controls [...]. Compliance functions shall be established at the level of the group. [...] The policies, procedures and controls pertaining to the sharing of information referred to in paragraph 1 shall require obliged entities within the group to exchange information when such sharing is relevant for the purposes of customer due diligence and money laundering and terrorist financing risk management.",
        "sub_requirements": [
            "Group-wide risk assessment and group-wide policies, procedures and controls",
            "Group-level compliance manager (and a compliance officer where justified), extent documented",
            "Information sharing within the group for CDD and risk management, with confidentiality and data protection guarantees",
        ],
        "academy_cases": [],
    },
    {
        "id": "AMLR-art18",
        "article": "18",
        "title": "Outsourcing",
        "what": "You may outsource AML/CFT tasks but stay fully liable: notify the supervisor first, check the provider is qualified, set a written agreement, test it regularly, and do not outsource the tasks Art. 18(3) reserves to you (risk assessment and policy approval, customer risk profile, onboarding decision, suspicious activity reporting, detection criteria), subject only to the narrow exceptions in Art. 18(3)(e) and 18(7).",
        "who": ALL_OBLIGED,
        "topic": "Governance",
        "priority": "high",
        "criticality": "high",
        "verbatim": "Obliged entities may outsource tasks resulting from this Regulation to service providers. The obliged entity shall notify the supervisor of the outsourcing before the service provider starts to carry out the outsourced task. [...] The obliged entity shall remain fully liable for any action, whether an act of commission or omission, connected to the outsourced tasks that are carried out by service providers. [...] The following tasks shall not be outsourced under any circumstances: (a) the proposal and approval of the obliged entity\u2019s business-wide risk assessment pursuant to Article 10(2); (b) the approval of the obliged entity\u2019s internal policies, procedures and controls pursuant to Article 9; (c) decision on the risk profile to be attributed to the customer; (d) the decision to enter into a business relationship or carry out an occasional transaction with a client; [...] (f) the approval of the criteria for the detection of suspicious or unusual transactions and activities. [...] The conditions for the performance of such tasks shall be laid down in a written agreement between the obliged entity and the service provider. The obliged entity shall perform regular controls to ascertain the effective implementation of such policies and procedures by the service provider.",
        "sub_requirements": [
            "Notify the supervisor before the provider starts",
            "Remain fully liable; be able to show the supervisor you understand the provider's approach",
            "Assure the provider is qualified before outsourcing; written agreement; same policies apply to sub-outsourcing",
            "Regular controls, frequency set by how critical the task is",
            "Tasks in Art. 18(3)(a) to (f) cannot be outsourced; limited exceptions: reporting within a group in the same Member State (18(3)(e)); certain collective investment undertakings, with prior supervisor approval (18(7))",
            "No outsourcing to high-risk third-country providers except within the same group on strict conditions (Art. 18(6))",
        ],
        "academy_cases": [],
    },
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
        "verbatim": "[...] obliged entities shall obtain at least the following information in order to identify the customer, any person purporting to act on behalf of the customer, and the natural persons on whose behalf or for the benefit of whom a transaction or activity is being conducted: (a) for a natural person: (i) all names and surnames; (ii) place and full date of birth; (iii) nationalities, or statelessness and refugee or subsidiary protection status where applicable, and the national identification number, where applicable; (iv) the usual place of residence [...]; (b) for a legal entity: (i) legal form and name of the legal entity; (ii) address of the registered or official office and, if different, the principal place of business, and the country of creation; (iii) the names of the legal representatives of the legal entity [...]; (c) for a trustee of an express trust or a person holding an equivalent position in a similar legal arrangement: (i) basic information on the legal arrangement [...]",
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
        "verbatim": "Verification of the identity of the customer, the beneficial owner, and of any persons pursuant to Article 20(1), points (h) and (i), shall take place before the establishment of a business relationship or the carrying out of an occasional transaction. Such obligation shall not apply to situations of lower risk under Section 3 of this Chapter, provided that the lower risk justifies postponement of such verification.",
        "sub_requirements": [
            "Default: verify before onboarding / before the transaction",
            "Derogation (para. 2): may be completed during establishment where necessary not to interrupt normal business and where ML/TF risk is little, as soon as practicable after initial contact",
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
        "verbatim": "Obliged entities shall conduct ongoing monitoring of business relationships, including transactions undertaken by the customer throughout the course of a business relationship, to ensure that those transactions are consistent with the obliged entity’s knowledge of the customer, the customer’s business activity and risk profile [...]",
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


import re as _re


def _norm(t):
    for a, b in (("\u2019", "'"), ("\u2018", "'"), ("\u201c", '"'), ("\u201d", '"'), ("\u00a0", " "), ("\u2011", "-"), ("\u2010", "-")):
        t = t.replace(a, b)
    return _re.sub(r"\s+", " ", t).strip().lower()


def assert_verbatim(obligation_id, excerpt, article_text):
    """Every segment between [...] elisions must appear word for word in the article."""
    text = _norm(article_text)
    for seg in _re.split(r"\[\.\.\.\]", excerpt):
        seg = _norm(seg.strip(" ;,."))
        if seg:
            assert seg in text, f"{obligation_id}: excerpt segment not found verbatim in the article: {seg[:90]!r}"


def build():
    laws_path = Path("docs/data/laws/32024R1624_EN.json")
    law = json.load(open(laws_path, encoding="utf-8"))
    art_by_id = {a["id"]: a for a in law["articles"]}

    records = []
    for o in OBLIGATIONS:
        art = art_by_id.get(o["article"])
        assert art is not None, f"Article {o['article']} not found in AMLR text"
        assert_verbatim(o["id"], o["verbatim"], art["text"])
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
            "scope": "AMLR (Regulation (EU) 2024/1624) Chapter II (internal policies, risk assessment, compliance functions, outsourcing; Arts 8 to 14, 16, 18) and Chapter III Section 1 (general CDD) plus EDD scope, PEP-specific provisions, and suspicious-transaction reporting.",
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
