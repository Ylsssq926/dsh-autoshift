import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutoAdapter, AUTO_PROVIDER, AUTO_MODEL } from './index.js';

const collect = async (stream) => { const out = []; for await (const chunk of stream) out.push(chunk); return out; };
const message = (text) => [{ role: 'user', content: [{ type: 'text', text }] }];
const roleOf = (chunks) => chunks.at(-1).replayState.response.routeView.role;
function relay(ids, config = {}, { behavior, options } = {}) {
  const calls = [];
  const state = { mounted: [{ id: 'relay' }] };
  const llm = {
    listProviders: () => state.mounted,
    listModels: async () => ids.map((id) => ({ id })),
    async *stream(streamOptions) {
      calls.push(streamOptions);
      if (behavior) { yield* behavior(streamOptions); return; }
      yield { type: 'finish', reason: { kind: 'stop' } };
    },
  };
  return { adapter: createAutoAdapter(llm, config, options), calls, state };
}

test('economy mode prefers a mini variant over a flagship for general chat', async () => {
  const { adapter, calls } = relay(['relay-pro', 'relay-mini'], { mode: 'economy' });
  await collect(adapter.stream({ messages: message('hello') }));
  assert.equal(calls[0].model, 'relay-mini');
});

test('balanced mode also leans cheap for general chat; quality mode ignores tier cost', async () => {
  const balanced = relay(['relay-pro', 'relay-mini'], { mode: 'balanced' });
  await collect(balanced.adapter.stream({ messages: message('hello') }));
  assert.equal(balanced.calls[0].model, 'relay-mini');
  const quality = relay(['relay-pro', 'relay-mini'], { mode: 'quality' });
  await collect(quality.adapter.stream({ messages: message('hello') }));
  assert.equal(quality.calls[0].model, 'relay-pro');
});

test('an engineering request picks the coder model even in economy mode', async () => {
  const { adapter, calls } = relay(['cheap-mini', 'team-coder'], { mode: 'economy' });
  await collect(adapter.stream({ messages: message('修复代码'), tools: [{ name: 'read' }] }));
  assert.equal(calls[0].model, 'team-coder');
});

test('a creative request picks the gemini family starter role', async () => {
  const { adapter, calls } = relay(['relay-mini', 'gemini-2.5-pro']);
  await collect(adapter.stream({ messages: message('写一个故事') }));
  assert.equal(calls[0].model, 'gemini-2.5-pro');
});

test('the exact catalog ID is forwarded verbatim, never the normalized form', async () => {
  const { adapter, calls } = relay(['Relay/GPT-5.4-Mini:free']);
  await collect(adapter.stream({ messages: message('hi') }));
  assert.equal(calls[0].provider, 'relay');
  assert.equal(calls[0].model, 'Relay/GPT-5.4-Mini:free');
});

test('case-duplicate catalog entries collapse to the first-seen ID', async () => {
  const { adapter, calls } = relay(['A-mini', 'a-mini'], { fallback: { maxAttempts: 1 } }, {
    behavior: async function* () { yield { type: 'finish', reason: { kind: 'error', failure: { code: 'RATE_LIMIT', message: 'x' } } }; },
  });
  const out = await collect(adapter.stream({ messages: message('hi') }));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, 'A-mini');
  assert.equal(out.at(-1).reason.failure.code, 'AUTO_NO_ROUTE');
});

test('preferences without economics keep the tier estimate instead of flagship cost', async () => {
  const { adapter, calls } = relay(['a-mini', 'z-standard'], {
    mode: 'economy',
    preferences: [{ provider: 'relay', model: 'z-standard', roles: { general: .95 } }],
  });
  await collect(adapter.stream({ messages: message('hello') }));
  assert.equal(calls[0].model, 'z-standard');
});

test('explicit route economics beat the name pattern', async () => {
  const { adapter, calls } = relay([], {
    mode: 'economy',
    routes: [
      { provider: 'relay', model: 'q-mini', roles: { general: .9 }, economics: { relativeCost: 1, latency: 1 } },
      { provider: 'relay', model: 'r-pro', roles: { general: .85 } },
    ],
  });
  await collect(adapter.stream({ messages: message('hello') }));
  assert.equal(calls[0].model, 'q-mini');
});

test('an unmounted pinned provider fails with an actionable code and zero new calls', async () => {
  const { adapter, calls, state } = relay(['m']);
  const first = await collect(adapter.stream({ messages: message('hi') }));
  const assistant = { role: 'assistant', content: [], source: {
    kind: 'model', provider: AUTO_PROVIDER, model: AUTO_MODEL, replayState: first.at(-1).replayState,
  } };
  state.mounted = [];
  const out = await collect(adapter.stream({ messages: [assistant, ...message('继续')] }));
  assert.equal(out.at(-1).reason.failure.code, 'AUTO_PIN_UNAVAILABLE');
  assert.equal(calls.length, 1);
});

test('string content, empty messages and image-only blocks never crash classification', async () => {
  const string = relay(['m']);
  const stringOut = await collect(string.adapter.stream({ messages: [{ role: 'user', content: '修复代码' }] }));
  assert.equal(string.calls.length, 1);
  assert.equal(roleOf(stringOut), 'implementer');
  const empty = relay(['m']);
  const emptyOut = await collect(empty.adapter.stream({ messages: [] }));
  assert.equal(empty.calls.length, 1);
  assert.equal(roleOf(emptyOut), 'general');
  const image = relay(['m']);
  const imageOut = await collect(image.adapter.stream({ messages: [{ role: 'user', content: [{ type: 'image', data: 'x' }] }] }));
  assert.equal(image.calls.length, 1);
  assert.equal(roleOf(imageOut), 'general');
});

test('steering messages do not override the real user request', async () => {
  const { adapter, calls } = relay(['gemini-2.5-pro', 'relay-mini']);
  const out = await collect(adapter.stream({ messages: [
    ...message('写一个故事'),
    { role: 'user', source: { kind: 'steering' }, content: [{ type: 'text', text: '修复代码' }] },
  ] }));
  assert.equal(calls[0].model, 'gemini-2.5-pro');
  assert.equal(roleOf(out), 'creative');
});

test('code fences, file paths and stack traces classify as engineering', async () => {
  for (const text of ['帮我看看这个\n```js\nconsole.log(1)\n```', '看看 src/router.mjs 为什么慢', 'TypeError: x\n    at fn (/app/a.js:1:2)', 'Traceback (most recent call last):']) {
    const { adapter, calls } = relay(['m']);
    const out = await collect(adapter.stream({ messages: message(text) }));
    assert.equal(calls.length, 1);
    assert.equal(roleOf(out), 'implementer', text);
  }
});

test('poetry and lyrics classify as creative', async () => {
  for (const text of ['写一首关于秋天的诗', 'write lyrics for a synthwave track']) {
    const { adapter } = relay(['m']);
    const out = await collect(adapter.stream({ messages: message(text) }));
    assert.equal(roleOf(out), 'creative', text);
  }
});

test('classification only reads the first 4000 characters of the request', async () => {
  const { adapter } = relay(['m']);
  const out = await collect(adapter.stream({ messages: message(`${'x'.repeat(4500)} 代码`) }));
  assert.equal(roleOf(out), 'general');
});

test('writer, researcher and architect requests route through the shared classifier', async () => {
  for (const [text, role] of [['帮我润色这封邮件', 'writer'], ['调研一下最新进展', 'researcher'], ['给出技术方案和架构', 'architect']]) {
    const { adapter, calls } = relay(['m']);
    const out = await collect(adapter.stream({ messages: message(text) }));
    assert.equal(calls.length, 1);
    assert.equal(roleOf(out), role, text);
  }
});

test('a writer request prefers a creative specialist when the pool has one', async () => {
  const { adapter, calls } = relay(['relay-mini', 'gemini-2.5-pro']);
  await collect(adapter.stream({ messages: message('帮我写一封邮件') }));
  assert.equal(calls[0].model, 'gemini-2.5-pro');
});

test('a researcher request without specialists falls back to the general pool', async () => {
  const { adapter, calls } = relay(['relay-mini', 'relay-pro'], { mode: 'economy' });
  const out = await collect(adapter.stream({ messages: message('调研一下最新进展') }));
  assert.equal(calls[0].model, 'relay-mini');
  assert.equal(roleOf(out), 'researcher');
});

test('claude family starter role wins engineering tasks in economy mode', async () => {
  const { adapter, calls } = relay(['relay-mini', 'claude-sonnet-4-5'], { mode: 'economy' });
  await collect(adapter.stream({ messages: message('修复代码'), tools: [{ name: 'read' }] }));
  assert.equal(calls[0].model, 'claude-sonnet-4-5');
});