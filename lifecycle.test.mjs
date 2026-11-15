import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutoAdapter, AUTO_PROVIDER, readAutoReplay } from './index.js';

const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const collect = async (stream) => { const out = []; for await (const chunk of stream) out.push(chunk); return out; };
const routes = [
  { id: 'engineering', provider: 'fixture', model: 'engineer', roles: ['engineering', 'general'], tools: true },
  { id: 'creative', provider: 'fixture', model: 'writer', roles: ['creative'], tools: true },
];
function make(config = { routes }, behavior) {
  const calls = [];
  const events = [];
  const session = { get seq() { return events.length; }, snapshotEvents: (from, to) => events.slice(from, to) };
  const llm = { listProviders: () => [{ id: 'fixture' }], async *stream(options) {
    calls.push(options);
    if (behavior) { yield* behavior(options); return; }
    yield { type: 'finish', reason: { kind: 'stop' } };
  } };
  const hostAdapter = createAutoAdapter(llm, config, { getSession: (id) => id === 's' ? session : undefined, today: () => '2026-11-10' });
  const adapter = { ...hostAdapter, stream: (options) => hostAdapter.stream({ sessionId: 's', ...options }) };
  return { adapter, calls, events, session, llm };
}
function assistant(end) {
  return { role: 'assistant', source: { kind: 'model', provider: AUTO_PROVIDER, model: 'auto', replayState: end.replayState }, content: [] };
}

test('cold resume recovers pinned route from log despite compacted messages', async () => {
  const first = make();
  const end = (await collect(first.adapter.stream({ sessionId: 's', messages: [user('代码修复')], tools: [{ name: 'read' }] }))).at(-1);
  const cold = make();
  cold.events.push({ type: 'assistant/message', data: { message: assistant(end) } });
  await collect(cold.adapter.stream({ sessionId: 's', messages: [user('写一个故事')] }));
  assert.equal(cold.calls[0].model, 'engineer');
});

test('changed route revision cannot silently reuse native cache state', async () => {
  const first = make();
  const end = (await collect(first.adapter.stream({ messages: [user('代码修复')] }))).at(-1);
  const revised = make({ routes: [{ ...routes[0], routeRevision: 'new' }] });
  const result = await collect(revised.adapter.stream({ messages: [assistant(end), user('继续')] }));
  assert.equal(result.at(-1).reason.failure.code, 'AUTO_NO_ROUTE');
  assert.equal(revised.calls.length, 0);
});

test('foreign old messages cannot be hidden behind a valid last replay', async () => {
  const { adapter, calls } = make();
  const good = { type: 'finish', replayState: { response: { tag: 'model-aware-auto/v1', provider: 'fixture', model: 'engineer' } } };
  const old = { role: 'assistant', source: { provider: 'other', model: 'foreign' }, content: [] };
  const result = await collect(adapter.stream({ messages: [old, assistant(good), user('继续')] }));
  assert.equal(result.at(-1).reason.failure.code, 'AUTO_NEW_SESSION_REQUIRED');
  assert.equal(calls.length, 0);
});

test('title and compaction requests do not select initial Auto route', async () => {
  const { adapter, calls } = make();
  const out = await collect(adapter.stream({ purpose: 'fixture-summary', messages: [user('总结')] }));
  assert.equal(out.at(-1).reason.failure.code, 'AUTO_AUXILIARY_UNPINNED');
  assert.equal(calls.length, 0);
});

test('disabled routes cannot be restored from replay', async () => {
  const { adapter, calls } = make({ routes: [{ ...routes[0], enabled: false }, routes[1]] });
  const end = { replayState: { response: { tag: 'model-aware-auto/v1', provider: 'fixture', model: 'engineer' } } };
  const result = await collect(adapter.stream({ messages: [assistant(end), user('写个故事')] }));
  assert.equal(result.at(-1).reason.failure.code, 'AUTO_NO_ROUTE');
  assert.equal(calls.length, 0);
});

test('per-route output caps never raise an explicit caller limit', async () => {
  const { adapter, calls } = make({ routes: [{ ...routes[0], maxOutputTokens: 200 }] });
  await collect(adapter.stream({ messages: [user('代码')], maxTokens: 100 }));
  await collect(adapter.stream({ messages: [user('代码')], maxTokens: 900 }));
  assert.deepEqual(calls.map((call) => call.maxTokens), [100, 200]);
});

test('only complete configured context limits appear in native metadata', async () => {
  const { adapter } = make({ routes: [{ ...routes[0], contextWindow: 32000 }, { ...routes[1], contextWindow: 64000 }] });
  assert.equal((await adapter.resolveModel(AUTO_PROVIDER, 'auto')).context.contextWindow, 32000);
  assert.throws(() => make({ routes: [{ ...routes[0], contextWindow: 100, maxOutputTokens: 100 }] }));
});

test('one failed provider result causes no retry, reviewer or fallback', async () => {
  const { adapter, calls } = make({ routes }, async function* () {
    yield { type: 'usage', usage: { inputTokens: 4, outputTokens: 1 } };
    yield { type: 'finish', reason: { kind: 'error', failure: { code: 'RATE_LIMIT', message: 'fixture' } }, replayState: { response: 'private' } };
  });
  const out = await collect(adapter.stream({ messages: [user('代码')] }));
  assert.equal(calls.length, 1);
  assert.equal(out[0].usage.inputTokens, 4);
  assert.equal(out.at(-1).replayState, undefined);
});

test('missing terminal result is explicit, not a fake success', async () => {
  const { adapter, calls } = make({ routes }, async function* () {});
  const out = await collect(adapter.stream({ messages: [user('代码')] }));
  assert.equal(calls.length, 1);
  assert.equal(out.at(-1).reason.failure.code, 'AUTO_INCOMPLETE_STREAM');
});

test('decimal role profiles and dimensions affect actual Auto selection', async () => {
  const { adapter, calls } = make({ routes: [
    { ...routes[0], roles: { engineering: .9 }, dimensions: { multiFileConsistency: .1 } },
    { ...routes[1], roles: { engineering: .9 }, dimensions: { multiFileConsistency: .9 } },
  ] });
  await collect(adapter.stream({ messages: [user('代码')] }));
  assert.equal(calls[0].model, 'writer'); // No brand-based inference: the configured profile wins.
});

test('external calibrated evidence can fill unknown dimensions but not overwrite manual values', async () => {
  const observation = { version: 1, provider: 'fixture', model: 'writer', dimension: 'coding', kind: 'benchmark', scope: 'fixture-v1', method: 'synthetic', source: 'https://example.com/eval', observedOn: '2026-10-01', reviewAfter: '2026-12-01', metric: { name: 'fixture', value: 1, unit: 'ratio' }, calibration: { score: 1, basis: 'synthetic test only' } };
  const config = { routes: routes.map((route) => ({ ...route, roles: { engineering: .9 } })), communityEvidence: { scope: 'fixture-v1', observations: [observation] } };
  const live = make(config);
  await collect(live.adapter.stream({ messages: [user('代码')] }));
  assert.equal(live.calls[0].model, 'writer');
  const manual = make({ ...config, routes: [config.routes[0], { ...config.routes[1], dimensions: { coding: 0 } }] });
  await collect(manual.adapter.stream({ messages: [user('代码')] }));
  assert.equal(manual.calls[0].model, 'engineer');
});

test('cold failed history and a missing live session both make zero dispatches', async () => {
  const { adapter, events, calls } = make();
  const absent = await collect(adapter.stream({ sessionId: 'missing', messages: [user('代码')] }));
  assert.equal(absent.at(-1).reason.failure.code, 'AUTO_SESSION_UNAVAILABLE');
  events.push({ type: 'assistant/attempt', data: {} });
  const failed = await collect(adapter.stream({ messages: [user('写个故事')] }));
  assert.equal(failed.at(-1).reason.failure.code, 'AUTO_NEW_SESSION_REQUIRED');
  assert.equal(calls.length, 0);
});

test('readAutoReplay is bounded to exact Auto source identity', () => {
  assert.equal(readAutoReplay({ role: 'assistant', source: { provider: 'foreign' } }), undefined);
});
