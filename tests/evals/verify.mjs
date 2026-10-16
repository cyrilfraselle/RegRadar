// Unit tests for the citation verifier, redaction, prompt and provider parsing. No dependencies. Run: node evals/verify.mjs
import assert from 'node:assert/strict';
import { AI } from './lib.mjs';

let n = 0;
const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error('FAIL ' + name + '\n  ' + e.message); process.exitCode = 1; } };
const tAsync = async (name, fn) => { try { await fn(); n++; } catch (e) { console.error('FAIL ' + name + '\n  ' + e.message); process.exitCode = 1; } };

const S = [
  { id: 'S1', text: 'Obliged entities shall retain the following documents and information:\n(a)\na copy of the documents obtained in the course of customer due diligence; non‑binding rules apply.' },
  { id: 'S2', text: 'Persons trading in goods may accept a payment in cash only up to an amount of EUR 10 000.' }
];

t('verified quote, whitespace and hyphen variants', () => {
  const r = AI.verifyCitations('Records must be kept: "shall retain the following documents and information" [S1]. Rules are "non-binding" [S1].', S);
  assert.equal(r.state, 'verified'); assert.equal(r.counts.failed, 0); assert.equal(r.canCopyAsChecked, true);
});
t('curly quotes and nbsp in the source', () => {
  const r = AI.verifyCitations('Cash limit: “only up to an amount of EUR 10 000” [S2].', S);
  assert.equal(r.state, 'verified');
});
t('altered quote is flagged', () => {
  const r = AI.verifyCitations('Records: "shall retain all documents and information" [S1].', S);
  assert.equal(r.state, 'failed'); assert.equal(r.quotes[0].status, 'not_found'); assert.equal(r.canCopyAsChecked, false);
});
t('quote from the wrong source is flagged', () => {
  const r = AI.verifyCitations('Cash: "only up to an amount of EUR 10 000" [S1].', S);
  assert.equal(r.quotes[0].status, 'wrong_source'); assert.deepEqual(r.quotes[0].foundIn, ['S2']); assert.equal(r.state, 'failed');
});
t('citation of a source that does not exist', () => {
  const r = AI.verifyCitations('Records: "shall retain the following documents" [S1][S7].', S);
  assert.equal(r.state, 'failed'); assert.equal(r.citations.filter((c) => c.status === 'invalid').length, 1);
});
t('quote with no citation is not verified', () => {
  const r = AI.verifyCitations('The law says "shall retain the following documents and information".', S);
  assert.equal(r.quotes[0].status, 'uncited'); assert.equal(r.state, 'failed');
});
t('ellipsis fragments must appear in order', () => {
  assert.equal(AI.verifyCitations('"Obliged entities [...] a copy of the documents obtained" [S1]', S).state, 'verified');
  assert.equal(AI.verifyCitations('"a copy of the documents [...] Obliged entities" [S1]', S).state, 'failed');
});
t('answer without quotes can never be "checked"', () => {
  const r = AI.verifyCitations('Records must be kept for a period [S1].', S);
  assert.equal(r.state, 'unchecked'); assert.equal(r.canCopyAsChecked, false);
});
t('abstention is recognised', () => {
  assert.equal(AI.verifyCitations('Not found in the supplied sources. The sources do not mention fees.', S).state, 'abstained');
});
t('grouped citation form [S1, S2]', () => {
  const r = AI.verifyCitations('Both say: "payment in cash only up to" [S1, S2].', S);
  assert.equal(r.state, 'verified');
});
t('annotate covers the whole answer', () => {
  const a = 'Cash: "only up to an amount of EUR 10 000" [S2] and more.';
  const seg = AI.annotateAnswer(a, AI.verifyCitations(a, S));
  assert.equal(seg.map((x) => x.text).join(''), a);
  assert.deepEqual(seg.map((x) => x.type), ['text', 'quote', 'text', 'cite', 'text']);
});

t('redaction', () => {
  const r = AI.redact('Mail jane.doe@example.com, IBAN BE68 5390 0754 7034, call +32 475 12 34 56, card 4111 1111 1111 1111, ask Maria Peeters about EUR 10 000 and Article 19 of 2024/1624 on 2024-05-31', { names: ['Maria Peeters'] });
  assert.ok(!/jane\.doe|BE68|475 12|4111|Maria/.test(r.text), r.text);
  assert.ok(/EUR 10 000/.test(r.text) && /Article 19/.test(r.text) && /2024\/1624/.test(r.text) && /2024-05-31/.test(r.text), r.text);
  assert.equal(r.replacements.map((x) => x.kind).sort().join(), 'email,iban,name,number,phone');
});

t('redaction keeps surrounding text', () => {
  assert.equal(AI.redact('ask Maria Peeters today', { names: ['maria peeters'] }).text, 'ask [NAME] today');
});

t('grounded prompt contains the rules', () => {
  const p = AI.buildGroundedPrompt({ question: 'Q?', sources: [{ kind: 'law', name: 'AMLR', art: '19', title: 'X', text: 'Body.' }] });
  for (const must of ['ONLY the numbered sources', '[S1]', 'verbatim', 'Not found in the supplied sources.', 'not legal advice']) assert.ok(p.system.includes(must), must);
  assert.ok(p.user.includes('<source id="S1"') && p.user.includes('Body.') && p.user.includes('Q?'));
});

const enc = new TextEncoder();
const sse = (events) => new Response(new ReadableStream({ start(c) { for (const e of events) c.enqueue(enc.encode(e)); c.close(); } }), { status: 200, headers: { 'request-id': 'req_test' } });

await tAsync('anthropic provider: request shape and streamed text (mocked fetch)', async () => {
  let seen;
  const fetchMock = async (url, init) => {
    seen = { url, init };
    return sse([
      'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":25,"output_tokens":1}}}\n\n',
      'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"hmm"}}\n\n',
      'event: ping\ndata: {"type":"ping"}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"Cash: \\"only up to an am"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"ount of EUR 10 000\\" [S2]"}}\n\n',
      'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":15}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n'
    ]);
  };
  const provider = AI.createAnthropicProvider({ apiKey: 'sk-test', fetch: fetchMock });
  const res = await AI.askModel({ provider, question: 'Cash limit?', sources: [S[1]] });
  assert.equal(seen.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(seen.init.headers['x-api-key'], 'sk-test');
  assert.equal(seen.init.headers['anthropic-version'], '2023-06-01');
  assert.equal(seen.init.headers['anthropic-dangerous-direct-browser-access'], 'true');
  const body = JSON.parse(seen.init.body);
  assert.equal(body.model, 'claude-sonnet-5-5'); assert.equal(body.stream, true); assert.ok(body.max_tokens > 0); assert.equal(body.messages[0].role, 'user'); assert.ok(body.system.includes('RULES'));
  assert.equal(res.answer, 'Cash: "only up to an amount of EUR 10 000" [S2]');
  assert.equal(res.verification.state, 'verified'); assert.equal(res.usage.output_tokens, 15); assert.equal(res.requestId, 'req_test');
  assert.ok(!JSON.stringify(provider.preview('s', 'u')).includes('sk-test'));
});
await tAsync('anthropic provider: HTTP 401 and mid-stream error', async () => {
  const p401 = AI.createAnthropicProvider({ apiKey: 'x', fetch: async () => new Response('{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}', { status: 401 }) });
  await assert.rejects(() => p401.complete({ system: 's', user: 'u' }), (e) => e.kind === 'http' && e.status === 401 && /rejected the key/.test(e.message));
  const pErr = AI.createAnthropicProvider({ apiKey: 'x', fetch: async () => sse(['event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n']) });
  await assert.rejects(() => pErr.complete({ system: 's', user: 'u' }), (e) => /overloaded/i.test(e.message));
  const pNet = AI.createAnthropicProvider({ apiKey: 'x', fetch: async () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(() => pNet.complete({ system: 's', user: 'u' }), (e) => e.kind === 'network');
});
await tAsync('openai-compatible provider (mocked fetch)', async () => {
  let seen;
  const p = AI.createOpenAICompatibleProvider({ baseUrl: 'https://llm.example/v1/', apiKey: 'k', model: 'm', fetch: async (u, i) => { seen = { u, i }; return sse(['data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n', 'data: {"choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}]}\n\n', 'data: [DONE]\n\n']); } });
  const r = await p.complete({ system: 's', user: 'u' });
  assert.equal(r.text, 'Hello'); assert.equal(seen.u, 'https://llm.example/v1/chat/completions'); assert.equal(seen.i.headers.authorization, 'Bearer k');
});
t('store: key, consent, history are device-local and clearable', () => {
  const mem = {}; const st = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
  const s = AI.createStore(st);
  assert.equal(s.hasConsent(), false); s.giveConsent(); assert.equal(s.hasConsent(), true);
  s.setKey('anthropic', ' k1 '); assert.equal(s.getKey('anthropic'), 'k1'); s.forgetKey('anthropic'); assert.equal(s.getKey('anthropic'), '');
  s.addHistory({ q: 'a' }); s.addHistory({ q: 'b' }); s.addHistory({ q: 'a' }); assert.deepEqual(s.history().map((x) => x.q), ['a', 'b']); s.clearHistory(); assert.equal(s.history().length, 0);
  assert.equal(s.getSettings().retrievalOnly, true);
});

console.log(n + ' checks passed' + (process.exitCode ? ' (with failures above)' : ''));
