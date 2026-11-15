import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutoAdapter, AUTO_PROVIDER } from './index.js';
const collect = async (stream) => { const out = []; for await (const chunk of stream) out.push(chunk); return out; };
const tools = [{ name: 'subagent', parameters: { type: 'object', properties: {
  prompt: { type: 'string' }, provider: { type: 'string' }, model: { type: 'string' },
} } }];
const routes = [
  { provider: 'p', model: 'parent', roles: ['general'], tools: true },
  { provider: 'p', model: 'child', roles: ['creative'], tools: true },
];
const original = JSON.stringify({ prompt: '写一段故事', description: 'Draft the story' });
function setup(authorized = true) {
  const calls = [];
  const events = authorized ? [{ type: 'subagent/model-selection-policy', data: { allowedModels: [{ provider: 'p', model: 'parent' }, { provider: 'p', model: 'child' }] } }] : [];
  const session = { header: {}, get seq() { return events.length; }, snapshotEvents: (from, to) => events.slice(from, to) };
  const llm = {
    listProviders: () => [{ id: 'p' }],
    async *stream(options) {
      calls.push(options);
      if (calls.length === 1) {
        yield { type: 'block-start', index: 0, blockType: 'tool-call' };
        yield { type: 'tool-call-delta', index: 0, id: 'call-1', name: 'subagent', argumentsDelta: original };
        yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: 'call-1', name: 'subagent', arguments: original } };
        yield { type: 'finish', reason: { kind: 'tool-calls' }, replayState: { response: 'native-parent' } };
      } else yield { type: 'finish', reason: { kind: 'stop' } };
    },
  };
  return { calls, events, session, adapter: createAutoAdapter(llm, { routes }, { getSession: () => session }) };
}

test('Auto integrates native child choice without starting or adding model calls', async () => {
  const { adapter, calls, events } = setup();
  const out = await collect(adapter.stream({ sessionId: 's', tools, messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }] }));
  const block = out.find((chunk) => chunk.type === 'block-end').block;
  const args = JSON.parse(block.arguments);
  assert.equal(args.model, 'child');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, 'parent');
  const replayState = out.at(-1).replayState;
  assert.equal(replayState.response.originalCalls[0].arguments, original);
  const message = { role: 'assistant', source: { provider: AUTO_PROVIDER, model: 'auto', replayState }, content: [block] };
  events.push({ type: 'assistant/message', data: { message } });
  await collect(adapter.stream({ sessionId: 's', tools, messages: [message, { role: 'tool', content: [{ type: 'text', text: 'started child' }] }] }));
  assert.equal(calls[1].messages[0].content[0].arguments, original);
  assert.deepEqual(calls[1].messages[0].source.replayState, { response: 'native-parent' });
});

test('no DSH child route policy means native inheritance, not a forced cross-model call', async () => {
  const { adapter, calls } = setup(false);
  const out = await collect(adapter.stream({ sessionId: 's', tools, messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }] }));
  assert.equal(out.find((chunk) => chunk.type === 'block-end').block.arguments, original);
  assert.equal(calls.length, 1);
});

test('a fresh child inheriting Auto uses the concrete parent route', async () => {
  const { adapter, calls, session, events } = setup(false);
  const parent = await collect(adapter.stream({ sessionId: 'p', tools, messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }] }));
  events.push({ type: 'assistant/message', data: { message: {
    role: 'assistant', source: { provider: AUTO_PROVIDER, model: 'auto', replayState: parent.at(-1).replayState }, content: [],
  } } });
  const child = { header: { origin: 'subagent', parentSession: 'p' }, seq: 0, snapshotEvents: () => [] };
  const llm = { listProviders: () => [{ id: 'p' }], async *stream(options) {
    calls.push(options); yield { type: 'finish', reason: { kind: 'stop' } };
  } };
  const resumed = createAutoAdapter(llm, { routes }, { getSession: (id) => ({ p: session, c: child })[id] });
  await collect(resumed.stream({ sessionId: 'c', messages: [{ role: 'user', content: [{ type: 'text', text: '写一段故事' }] }] }));
  assert.equal(calls[1].model, 'parent');
  assert.equal(calls[1].messages.length, 1);
});
