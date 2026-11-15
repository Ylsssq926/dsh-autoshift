import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutoAdapter } from './index.js';
const collect = async (stream) => { const out = []; for await (const chunk of stream) out.push(chunk); return out; };

test('preferences refine one discovered route without making other routes unavailable', async () => {
  const calls = [];
  const llm = {
    listProviders: () => [{ id: 'p' }],
    listModels: async () => [{ id: 'creative-model' }, { id: 'ordinary-model' }],
    async *stream(options) { calls.push(options); yield { type: 'finish', reason: { kind: 'stop' } }; },
  };
  const adapter = createAutoAdapter(llm, { preferences: [{ provider: 'p', model: 'creative-model', roles: ['creative'] }] });
  await collect(adapter.stream({ messages: [{ role: 'user', content: [{ type: 'text', text: '写一个故事' }] }] }));
  await collect(adapter.stream({ messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }] }));
  assert.deepEqual(calls.map(({ model }) => model), ['creative-model', 'ordinary-model']);
});

test('catalog cache avoids repeated model discovery but not model calls', async () => {
  let discovery = 0; let calls = 0;
  const llm = {
    listProviders: () => [{ id: 'p' }],
    listModels: async () => { discovery++; return [{ id: 'ordinary-model' }]; },
    async *stream() { calls++; yield { type: 'finish', reason: { kind: 'stop' } }; },
  };
  const adapter = createAutoAdapter(llm, {});
  for (let i = 0; i < 2; i++) await collect(adapter.stream({ messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }] }));
  assert.equal(discovery, 1);
  assert.equal(calls, 2);
});

const message = (text) => [{ role: 'user', content: [{ type: 'text', text }] }];

test('general ties prefer a concrete DSH default over catalog order', async () => {
  const calls = [];
  const llm = {
    listProviders: () => [{ id: 'p' }],
    listModels: async () => [{ id: 'first' }, { id: 'preferred' }],
    async *stream({ model }) { calls.push(model); yield { type: 'finish', reason: { kind: 'stop' } }; },
  };
  const adapter = createAutoAdapter(llm, {}, { getDefaultModel: () => ({ provider: 'p', model: 'preferred' }) });
  await collect(adapter.stream({ messages: message('你好') }));
  assert.deepEqual(calls, ['preferred']);
});

test('zero config skips failed providers, duplicate IDs and the Auto entry itself', async () => {
  const calls = [];
  const llm = {
    listProviders: () => [{ id: 'broken' }, { id: 'p' }, { id: 'model-aware-auto' }],
    async listModels(provider) {
      assert.notEqual(provider, 'model-aware-auto');
      if (provider === 'broken') throw new Error('offline');
      return [{ id: 'auto' }, { id: 'vision-only', inputModalities: ['image'] }, { id: 'unknown' }, { id: 'unknown' }];
    },
    async *stream({ provider, model }) { calls.push([provider, model]); yield { type: 'finish', reason: { kind: 'stop' } }; },
  };
  await collect(createAutoAdapter(llm).stream({ messages: message('修复代码'), tools: [{ name: 'read' }] }));
  assert.deepEqual(calls, [['p', 'vision-only']]);
});

test('configured economics can change ranking without adding a model request', async () => {
  const calls = [];
  const llm = {
    listProviders: () => [{ id: 'p' }],
    async *stream({ model }) { calls.push(model); yield { type: 'finish', reason: { kind: 'stop' } }; },
  };
  const routes = [
    { provider: 'p', model: 'high-fit', roles: { general: .9 }, economics: { relativeCost: 1 } },
    { provider: 'p', model: 'low-cost', roles: { general: .82 }, economics: { relativeCost: .2 } },
  ];
  for (const mode of ['quality', 'economy']) await collect(createAutoAdapter(llm, { routes, mode }).stream({ messages: message('你好') }));
  assert.deepEqual(calls, ['high-fit', 'low-cost']);
});

test('cancellation during discovery never starts an inference', async () => {
  const controller = new AbortController();
  let dispatches = 0;
  const llm = {
    listProviders: () => [{ id: 'p' }],
    async listModels() { controller.abort(); return [{ id: 'unknown' }]; },
    async *stream() { dispatches++; },
  };
  const result = await collect(createAutoAdapter(llm).stream({ messages: message('hi'), signal: controller.signal }));
  assert.equal(result.at(-1).reason.kind, 'aborted');
  assert.equal(dispatches, 0);
});
