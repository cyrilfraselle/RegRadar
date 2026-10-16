/* ═══════════════════════════════════════════════════════════════
   RegRadar: STR/SAR narrative builder (deterministic, no AI)

   Turns the structured case form into a plain, regulator-friendly draft
   narrative with fixed templates, checks completeness, and runs a
   plain-language quality checklist. Same inputs always give the same
   text. Exposed as window.CasesNarr; used by cases.js.
   ═══════════════════════════════════════════════════════════════ */
window.CasesNarr = (function () {
  'use strict';

  var ACTIONS = [
    ['monitoring', 'Placed the account under enhanced monitoring'],
    ['rfi', 'Reviewed the customer file and asked internal teams for information'],
    ['screening', 'Re-screened for sanctions, PEP status and adverse media'],
    ['media', 'Searched public sources and adverse media'],
    ['restrict', 'Restricted or blocked the account or product'],
    ['review', 'Brought forward the customer risk review'],
    ['exit', 'Started the process to end the relationship']
  ];

  var GROUPS = [
    { id: 'who', title: 'Who is involved', hint: 'The subject of the report and how they relate to you. Use references, not real names, in this prototype.' },
    { id: 'what', title: 'What happened', hint: 'Describe the activity in two or three plain sentences, then how it was carried out.' },
    { id: 'when', title: 'When', hint: 'Dates make the report usable. Say when it happened, when you noticed, and when suspicion formed.' },
    { id: 'where', title: 'Where', hint: 'Countries, channels, accounts and the institutions on the other side.' },
    { id: 'howmuch', title: 'How much', hint: 'Total value, number of transactions, and what was expected for this customer.' },
    { id: 'why', title: 'Why it is suspicious', hint: 'The reasons, tied to facts. Say what you checked and why the explanations were not enough.' },
    { id: 'actions', title: 'What you have done', hint: 'Steps taken so far, how pending transactions were handled, and the tipping-off confirmation.' },
    { id: 'docs', title: 'Supporting documents', hint: 'What you hold and can give the FIU on request. Evidence logged on the case is added automatically.' },
    { id: 'report', title: 'Report details', hint: 'Who is reporting, under what basis, and the contact for follow-up.' }
  ];

  var SUSP_OPTS = [['tbd', 'Choose'], ['ml', 'Money laundering'], ['tf', 'Terrorist financing'], ['predicate', 'Proceeds of criminal activity (predicate offence)']];
  var HANDLING_OPTS = [
    ['', 'Choose'],
    ['held', 'Transactions were held until the report was submitted'],
    ['executed', 'Transactions went ahead after assessing the risk of proceeding'],
    ['infeasible', 'Could not refrain from the transaction (or refraining would frustrate the pursuit of beneficiaries)'],
    ['none', 'No transaction was pending']
  ];

  var FIELDS = [
    { k: 'type', g: 'report', label: 'Report type', type: 'select', opts: [['STR', 'Suspicious transaction report (STR)'], ['SAR', 'Suspicious activity report (SAR)']] },
    { k: 'suspicion', g: 'why', label: 'What do you suspect?', type: 'select', req: true, opts: SUSP_OPTS, help: 'Choose the closest. A suspicion, not proof, is what triggers the duty.' },
    { k: 'attempted', g: 'report', label: 'This report concerns an attempted transaction', type: 'checkbox' },
    { k: 'cddFailure', g: 'report', label: 'The suspicion arose because customer due diligence could not be completed', type: 'checkbox' },
    { k: 'entityName', g: 'report', label: 'Reporting entity', type: 'text', req: true },
    { k: 'officerName', g: 'report', label: 'Compliance officer (MLRO) name', type: 'text', req: true },
    { k: 'officerContact', g: 'report', label: 'Contact for FIU follow-up', type: 'text', help: 'A role mailbox and phone number the FIU can use.' },
    { k: 'legalBasis', g: 'report', label: 'Legal basis stated in the report', type: 'text', help: 'Default text, edit to match the law and FIU format that apply to you today.' },

    { k: 'subjectName', g: 'who', label: 'Subject (name or reference)', type: 'text', req: true, help: 'In this prototype use a pseudonym or customer ID, never a real name.' },
    { k: 'subjectType', g: 'who', label: 'Subject type', type: 'select', opts: [['individual', 'Individual'], ['legal', 'Legal entity or arrangement']] },
    { k: 'subjectIds', g: 'who', label: 'Identifiers held', type: 'text', req: true, help: 'Customer ID, registration number, date of birth or incorporation (references only here).' },
    { k: 'relationship', g: 'who', label: 'Relationship with you', type: 'text', req: true, help: 'For example: retail customer since 2022, payment account, standard risk.' },
    { k: 'riskRating', g: 'who', label: 'Customer risk rating', type: 'select', opts: [['', 'Not stated'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']] },
    { k: 'pep', g: 'who', label: 'PEP status', type: 'select', opts: [['', 'Not stated'], ['no', 'Not a PEP'], ['yes', 'PEP, family member or close associate'], ['unknown', 'Unknown']] },
    { k: 'occupation', g: 'who', label: 'Occupation or nature of business', type: 'text' },
    { k: 'otherParties', g: 'who', label: 'Other parties involved', type: 'textarea', rows: 2 },

    { k: 'activitySummary', g: 'what', label: 'What happened (summary)', type: 'textarea', req: true, rows: 3, help: 'Two or three sentences. Facts first.' },
    { k: 'method', g: 'what', label: 'How it was carried out', type: 'textarea', req: true, rows: 3, help: 'The mechanics: channel, route, counterparties, pattern.' },

    { k: 'periodStart', g: 'when', label: 'Activity from', type: 'date', req: true },
    { k: 'periodEnd', g: 'when', label: 'Activity to', type: 'date', req: true },
    { k: 'detectedOn', g: 'when', label: 'Detected on', type: 'date' },
    { k: 'suspicionFormedOn', g: 'when', label: 'Suspicion formed on', type: 'date', req: true, help: 'The date it became a suspicion. The law asks for reports to be made promptly.' },

    { k: 'jurisdictions', g: 'where', label: 'Countries involved', type: 'text', req: true },
    { k: 'channels', g: 'where', label: 'Channels or products', type: 'text' },
    { k: 'accounts', g: 'where', label: 'Accounts or wallets (references)', type: 'text' },
    { k: 'counterpartyInstitutions', g: 'where', label: 'Counterparty institutions', type: 'text' },

    { k: 'totalAmount', g: 'howmuch', label: 'Total amount', type: 'text', req: true, help: 'Digits only, for example 53,400.' },
    { k: 'currency', g: 'howmuch', label: 'Currency', type: 'text' },
    { k: 'txCount', g: 'howmuch', label: 'Number of transactions', type: 'text' },
    { k: 'expectedActivity', g: 'howmuch', label: 'Expected activity for this customer', type: 'textarea', rows: 2, help: 'What the profile or onboarding file said to expect. This is the baseline the report compares against.' },

    { k: 'whyText', g: 'why', label: 'Why this is suspicious', type: 'textarea', req: true, rows: 4, help: 'Tie each reason to a fact. Avoid conclusions such as "this is laundering".' },
    { k: 'includeFlags', g: 'why', label: 'Add the red flags marked present on the case to the narrative', type: 'checkbox' },
    { k: 'explanations', g: 'why', label: 'Explanations considered', type: 'textarea', rows: 2, help: 'What innocent explanations you looked at and why they do not hold.' },

    { k: 'actions', g: 'actions', label: 'Steps taken', type: 'checks', opts: ACTIONS },
    { k: 'actionsOther', g: 'actions', label: 'Other steps', type: 'textarea', rows: 2 },
    { k: 'transactionHandling', g: 'actions', label: 'Handling of transactions', type: 'select', req: true, opts: HANDLING_OPTS },
    { k: 'tippingAck', g: 'actions', label: 'I confirm the customer has not been told about this assessment or report', type: 'checkbox', req: true },

    { k: 'docsText', g: 'docs', label: 'Other documents held', type: 'textarea', rows: 2 }
  ];

  var req = FIELDS.filter(function (f) { return f.req; });

  function t(v) { return String(v == null ? '' : v).trim(); }
  function longDate(iso) {
    var p = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    if (!p) return t(iso);
    return new Date(+p[1], +p[2] - 1, +p[3]).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function M(label) { return '[NOT PROVIDED: ' + label + ']'; }
  function pick(n, k, label) { var v = t(n[k]); return v || M(label); }
  function sentence(s) { s = t(s); if (!s) return s; return /[.!?]$/.test(s) ? s : s + '.'; }
  function actionLabel(id) { for (var i = 0; i < ACTIONS.length; i++) if (ACTIONS[i][0] === id) return ACTIONS[i][1]; return id; }

  function isFilled(n, f, ctx) {
    if (f.type === 'checkbox') return !!n[f.k];
    if (f.k === 'suspicion') return !!n.suspicion && n.suspicion !== 'tbd';
    return !!t(n[f.k]);
  }

  function completeness(n, ctx) {
    var items = [];
    req.forEach(function (f) {
      items.push({ k: f.k, group: f.g, label: f.label, ok: isFilled(n, f, ctx) });
    });
    items.push({ k: 'actions', group: 'actions', label: 'At least one step taken (or another step described)', ok: !!((n.actions || []).length || t(n.actionsOther)) });
    items.push({ k: 'docsText', group: 'docs', label: 'Supporting documents listed (evidence on the case or described)', ok: !!(((ctx && ctx.evidence) || []).length || t(n.docsText)) });
    var ok = items.filter(function (i) { return i.ok; }).length;
    return { items: items, ok: ok, total: items.length, pct: Math.round(100 * ok / items.length) };
  }

  function build(n, ctx) {
    n = n || {}; ctx = ctx || {};
    var L = [];
    var ent = t(n.entityName) || M('reporting entity');
    var typeName = n.type === 'SAR' ? 'SUSPICIOUS ACTIVITY REPORT (SAR)' : 'SUSPICIOUS TRANSACTION REPORT (STR)';
    var subj = pick(n, 'subjectName', 'subject');
    var susp = { ml: 'money laundering', tf: 'terrorist financing', predicate: 'the proceeds of criminal activity' }[n.suspicion];

    L.push(typeName + ': DRAFT NARRATIVE');
    L.push('Case reference: ' + (ctx.ref || M('case reference')));
    L.push('Prepared: ' + longDate(ctx.todayIso || ''));
    L.push('Legal basis: ' + (t(n.legalBasis) || M('legal basis')));
    L.push('');

    L.push('1. SUMMARY');
    var s1 = ent + ' reports a suspicion of ' + (susp || M('type of suspicion')) + ' concerning ' + subj + '.';
    if (n.attempted) s1 += ' This report concerns an attempted transaction.';
    if (n.cddFailure) s1 += ' The suspicion arose because customer due diligence could not be completed.';
    L.push(s1);
    L.push(sentence(pick(n, 'activitySummary', 'summary of what happened')));
    L.push('');

    L.push('2. WHO IS INVOLVED');
    L.push('- Subject: ' + subj + (n.subjectType === 'legal' ? ' (legal entity or arrangement)' : ' (individual)'));
    L.push('- Identifiers held: ' + pick(n, 'subjectIds', 'identifiers'));
    L.push('- Relationship with us: ' + pick(n, 'relationship', 'relationship'));
    if (t(n.riskRating)) L.push('- Customer risk rating: ' + n.riskRating);
    if (n.pep === 'no') L.push('- PEP status: not a PEP');
    else if (n.pep === 'yes') L.push('- PEP status: PEP, family member or close associate');
    else if (n.pep === 'unknown') L.push('- PEP status: unknown');
    if (t(n.occupation)) L.push('- Occupation or business: ' + t(n.occupation));
    if (t(n.otherParties)) L.push('- Other parties: ' + t(n.otherParties));
    L.push('');

    L.push('3. HOW IT WAS CARRIED OUT');
    L.push(sentence(pick(n, 'method', 'how it was carried out')));
    L.push('');

    L.push('4. WHEN');
    var ps = longDate(n.periodStart), pe = longDate(n.periodEnd);
    L.push('The activity took place between ' + (ps || M('start date')) + ' and ' + (pe || M('end date')) + '.');
    if (t(n.detectedOn)) L.push('It was detected on ' + longDate(n.detectedOn) + '.');
    L.push('Suspicion was formed on ' + (longDate(n.suspicionFormedOn) || M('date suspicion formed')) + '.');
    L.push('');

    L.push('5. WHERE');
    L.push('- Countries involved: ' + pick(n, 'jurisdictions', 'countries involved'));
    if (t(n.channels)) L.push('- Channels or products: ' + t(n.channels));
    if (t(n.accounts)) L.push('- Accounts or wallets: ' + t(n.accounts));
    if (t(n.counterpartyInstitutions)) L.push('- Counterparty institutions: ' + t(n.counterpartyInstitutions));
    L.push('');

    L.push('6. HOW MUCH');
    var amt = t(n.totalAmount);
    var cur = t(n.currency);
    var cnt = t(n.txCount);
    L.push('Total value: ' + (amt ? ((cur ? cur + ' ' : '') + amt) : M('total amount')) + (cnt ? ' across ' + cnt + ' transactions.' : '.'));
    if (t(n.expectedActivity)) L.push('Expected activity for this customer: ' + sentence(n.expectedActivity));
    L.push('');

    L.push('7. WHY WE CONSIDER IT SUSPICIOUS');
    L.push(sentence(pick(n, 'whyText', 'reasons for suspicion')));
    var fl = n.includeFlags === false ? [] : (ctx.flagsPresent || []);
    if (fl.length) {
      L.push('Indicators present:');
      fl.forEach(function (x) { L.push('- ' + x); });
    }
    if (t(n.explanations)) L.push('Explanations considered: ' + sentence(n.explanations));
    L.push('');

    L.push('8. ACTIONS TAKEN');
    var acts = (n.actions || []).map(actionLabel);
    if (t(n.actionsOther)) acts.push(t(n.actionsOther));
    if (acts.length) acts.forEach(function (a) { L.push('- ' + sentence(a)); });
    else L.push('- ' + M('steps taken'));
    var h = n.transactionHandling;
    if (h === 'held') L.push('Pending transactions were held until this report was submitted.');
    else if (h === 'executed') L.push('Transactions were carried out after we assessed the risks of proceeding.');
    else if (h === 'infeasible') L.push('It was not possible to refrain from the transaction, or refraining would have been likely to frustrate efforts to pursue the beneficiaries. The FIU is informed immediately after the transaction.');
    else if (h === 'none') L.push('No transaction was pending when this report was prepared.');
    else L.push(M('how transactions were handled'));
    L.push(n.tippingAck ? 'The customer has not been informed of this assessment or of this report.' : M('confirmation that the customer was not informed'));
    L.push('');

    L.push('9. SUPPORTING DOCUMENTS');
    var docs = [];
    (ctx.evidence || []).forEach(function (e) { docs.push(e.label + (e.kind ? ' (' + e.kind + ')' : '')); });
    if (t(n.docsText)) docs.push(t(n.docsText));
    if (docs.length) {
      docs.forEach(function (d) { L.push('- ' + sentence(d)); });
      L.push('These documents are held by ' + ent + ' and can be provided to the FIU on request.');
    } else L.push('- ' + M('supporting documents'));
    L.push('');

    L.push('10. CONTACT');
    L.push('Compliance officer: ' + pick(n, 'officerName', 'compliance officer name') + (t(n.officerContact) ? ', ' + t(n.officerContact) : '') + '.');
    return L.join('\n');
  }

  /* ----- plain-language quality checklist ----- */
  var ACCUSE = /\b(guilty|fraudster|money launderer|criminal gang|obviously|clearly (?:a |an )?(?:criminal|fraud|launder)|definitely|undoubtedly|proven|proof that)\b/i;
  var TIPOFF = /(told|informed|notified|advised|warned|contacted|called|asked)\s+(?:the\s+|our\s+)?(customer|client|subject|account holder)\b|(customer|client|subject) (?:was|has been|were) (?:told|informed|notified|made aware)/i;

  function words(s) { var m = t(s).match(/\S+/g); return m ? m.length : 0; }

  function quality(text, n, ctx) {
    text = text || ''; n = n || {};
    var out = [];
    function add(id, label, status, detail) { out.push({ id: id, label: label, status: status, detail: detail }); }
    var c = completeness(n, ctx);
    add('six', 'Answers who, what, when, where, how much and why',
      c.ok === c.total ? 'pass' : 'fail',
      c.ok === c.total ? 'Every required answer is filled in.' : (c.total - c.ok) + ' required answer' + (c.total - c.ok === 1 ? ' is' : 's are') + ' still missing.');

    var left = /\[NOT PROVIDED/.test(text);
    add('placeholders', 'No gaps left in the text', left ? 'fail' : 'pass', left ? 'The text still contains [NOT PROVIDED] markers. Fill them or remove them.' : 'No placeholder markers remain.');

    var sw = words(n.activitySummary);
    add('summary', 'The summary is short and up front', sw === 0 ? 'fail' : (sw > 90 ? 'warn' : 'pass'),
      sw === 0 ? 'Write two or three sentences on what happened.' : (sw > 90 ? 'The summary is ' + sw + ' words. Aim for under 90 and move detail to the sections below.' : 'The summary is ' + sw + ' words.'));

    var amountHits = (text.match(/\d[\d,.]*\d|\d/g) || []).length;
    var dateHits = (text.match(/\b\d{1,2} [A-Z][a-z]+ \d{4}\b/g) || []).length;
    add('specific', 'Uses specific figures and dates', (t(n.totalAmount) && dateHits >= 2) ? 'pass' : 'warn',
      (t(n.totalAmount) && dateHits >= 2) ? 'Amount and ' + dateHits + ' dates are stated.' : 'Give the total amount and at least two dates (period, detection or suspicion).');

    var base = t(n.expectedActivity);
    add('baseline', 'Compares the activity with what was expected', base ? 'pass' : 'warn',
      base ? 'The expected activity for this customer is stated.' : 'Say what you expected for this customer. A suspicion rests on the gap, not the amount alone.');

    var why = words(n.whyText);
    add('why', 'Explains why, tied to facts', why >= 40 ? 'pass' : (why === 0 ? 'fail' : 'warn'),
      why >= 40 ? 'The reasons run to ' + why + ' words.' : 'The reasons are ' + why + ' words. Say what is unusual, compared with what, and why that is not explained.');

    var acc = ACCUSE.exec(text);
    add('facts', 'States facts and a suspicion, not a verdict', acc ? 'warn' : 'pass',
      acc ? 'The words "' + acc[0] + '" read as a conclusion. A report says what you saw and why it is suspicious; the authorities decide the rest.' : 'No conclusion-style wording found.');

    var tip = TIPOFF.exec(text);
    var ack = !!n.tippingAck;
    add('tipping', 'Nothing in the text tells the customer or hints at a report',
      !ack ? 'fail' : (tip ? 'warn' : 'pass'),
      !ack ? 'Tick the confirmation that the customer has not been told about this assessment or report.'
        : (tip ? 'The text mentions contact with the customer ("' + tip[0] + '"). Check that nothing disclosed the report or the assessment.' : 'Confirmed, and no customer-contact wording found.'));

    var h = t(n.transactionHandling);
    add('handling', 'Says whether transactions were held or carried out', h ? 'pass' : 'fail', h ? 'Stated.' : 'Choose how pending transactions were handled.');

    var prose = text.split('\n').filter(function (l) { return /\.\s*$/.test(l) && words(l) > 8 && !/^\s*-/.test(l); });
    var wc = prose.reduce(function (a, l) { return a + words(l); }, 0);
    var sc = prose.reduce(function (a, l) { return a + Math.max(1, (l.match(/[.!?](\s|$)/g) || []).length); }, 0);
    var avg = sc ? Math.round(wc / sc) : 0;
    add('plain', 'Plain sentences', avg > 28 ? 'warn' : 'pass', avg > 28 ? 'Sentences average ' + avg + ' words. Split the long ones; the FIU reads many of these.' : (avg ? 'Sentences average ' + avg + ' words.' : 'Not enough prose to measure.'));

    var docs = ((ctx && ctx.evidence) || []).length || t(n.docsText);
    add('docs', 'Lists the supporting documents', docs ? 'pass' : 'fail', docs ? 'Documents are listed.' : 'List what you hold so the FIU knows what to ask for.');

    add('contact', 'Names a contact for follow-up', t(n.officerName) ? (t(n.officerContact) ? 'pass' : 'warn') : 'fail',
      t(n.officerName) ? (t(n.officerContact) ? 'Contact is given.' : 'Add a mailbox or phone number the FIU can use.') : 'Name the compliance officer.');

    return out;
  }

  return { GROUPS: GROUPS, FIELDS: FIELDS, ACTIONS: ACTIONS, build: build, completeness: completeness, quality: quality, longDate: longDate };
})();
