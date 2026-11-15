import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutoAdapter, AUTO_PROVIDER } from './index.js';

const route = { provider: 'fixture', model: 'engineering-v1', roles: ['general', 'engineering'], tools: true };
const user = { role: 'user', content: [{ type: 'text', text: '修复代码' }] };
const collect = async (stream) => { const chunks = []; for await (const chunk of stream) chunks.push(chunk); return chunks; };
function harness(routes = [route]) {
  const calls = [];
  const usage = { type: 'usage', usage: { inputTokens: 10, outputTokens: 3, cacheReadTokens: 5 } };
  const llm = {
    listProviders: () => [{ id: 'fixture' }, { id: AUTO_PROVIDER }],
    async *stream(options) {
      calls.push(options);
      yield usage;
      yield { type: 'finish', reason: { kind: 'stop' }, replayState: { response: { signature: 'fixture-only' } } };
    },
  };
  return { adapter: createAutoAdapter(llm, { routes }), calls, usage };
}

test('native catalog advertises Auto without inventing a context window', async () => {
  const { adapter } = harness();
  assert.equal((await adapter.listModels())[0].name, 'Auto');
  assert.equal((await adapter.resolveModel(AUTO_PROVIDER, 'auto')).context, undefined);
  await assert.rejects(() => adapter.resolveModel(AUTO_PROVIDER, 'other'), /Unknown Auto model/);
  const prepared = await adapter.prepareCall(AUTO_PROVIDER, 'auto');
  assert.equal(typeof prepared.stream, 'function');
});

test('empty explicit pool makes zero provider calls', async () => {
  const { adapter, calls } = harness([]);
  const chunks = await collect(adapter.stream({ messages: [user] }));
  assert.equal(chunks.at(-1).reason.failure.code, 'AUTO_NO_MODEL');
  assert.equal(calls.length, 0);
});

test('an engineering request forwards exactly once and keeps usage unchanged', async () => {
  const { adapter, calls, usage } = harness();
  const options = Object.freeze({ messages: Object.freeze([user]), tools: [{ name: 'read' }] });
  const chunks = await collect(adapter.stream(options));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].provider, route.provider);
  assert.equal(calls[0].model, route.model);
  assert.deepEqual(chunks[0], usage);
  assert.equal(typeof chunks.at(-1).replayState.response.routeView, 'object');
  assert.equal(chunks.at(-1).replayState.response.routeView.provider, route.provider);
});

test('continuation pins the route and unwraps only that route native replay', async () => {
  const { adapter, calls } = harness([route, { provider: 'fixture', model: 'creative-v1', roles: ['creative'], tools: true }]);
  const first = await collect(adapter.stream({ messages: [user] }));
  const assistant = { role: 'assistant', content: [{ type: 'text', text: 'Done' }], source: {
    kind: 'model', provider: AUTO_PROVIDER, model: 'auto', replayState: first.at(-1).replayState,
  } };
  const writing = { role: 'user', content: [{ type: 'text', text: '写一段故事' }] };
  await collect(adapter.stream({ messages: [user, assistant, writing] }));
  assert.equal(calls[1].model, route.model);
  assert.deepEqual(calls[1].messages[1].source.replayState, { response: { signature: 'fixture-only' } });
});

test('no implicit tools access and no pool fallback calls', async () => {
  const { adapter, calls } = harness([{ ...route, tools: false }]);
  const chunks = await collect(adapter.stream({ messages: [user], tools: [{ name: 'write' }] }));
  assert.equal(chunks.at(-1).reason.failure.code, 'AUTO_NO_ROUTE');
  assert.equal(calls.length, 0);
});

test('switching a preexisting conversation is refused before dispatch', async () => {
  const { adapter, calls } = harness();
  const old = { role: 'assistant', content: [], source: { provider: 'other', model: 'x' } };
  const chunks = await collect(adapter.stream({ messages: [old, user] }));
  assert.equal(chunks.at(-1).reason.failure.code, 'AUTO_NEW_SESSION_REQUIRED');
  assert.equal(calls.length, 0);
});

test('cancellation before dispatch costs zero calls', async () => {
  const { adapter, calls } = harness();
  const controller = new AbortController();
  controller.abort();
  const chunks = await collect(adapter.stream({ messages: [user], signal: controller.signal }));
  assert.equal(chunks.at(-1).reason.kind, 'aborted');
  assert.equal(calls.length, 0);
});

test('invalid and recursive pool entries reject before registration', () => {
  assert.throws(() => harness([{ ...route, provider: AUTO_PROVIDER }]));
  assert.throws(() => harness([route, route]));
  assert.throws(() => harness([{ ...route, roles: ['unknown'] }]));
});
