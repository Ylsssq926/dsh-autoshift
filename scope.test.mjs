import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutoAdapter } from './index.js';
const collect = async (stream) => { const out = []; for await (const chunk of stream) out.push(chunk); return out; };
const user = [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }];

test('default catalog keeps unknown and image-only models eligible', async () => {
  const calls = [];
  const llm = { listProviders: () => [{ id: 'p' }], listModels: async () => [{ id: 'image-only', inputModalities: ['image'] }, { id: 'unknown' }], async *stream({ model }) { calls.push(model); yield { type: 'finish', reason: { kind: 'stop' } }; } };
  await collect(createAutoAdapter(llm).stream({ messages: user }));
  assert.equal(calls.length, 1);
  assert.ok(['image-only', 'unknown'].includes(calls[0]));
});

test('scope can allow providers and models or exclude them', async () => {
  const calls = [];
  const llm = { listProviders: () => [{ id: 'a' }, { id: 'b' }], listModels: async (provider) => [{ id: provider === 'a' ? 'keep' : 'drop' }], async *stream({ provider }) { calls.push(provider); yield { type: 'finish', reason: { kind: 'stop' } }; } };
  await collect(createAutoAdapter(llm, { scope: { providers: ['a'] } }).stream({ messages: user }));
  assert.deepEqual(calls, ['a']);
  const calls2 = [];
  const llm2 = { ...llm, async *stream({ model }) { calls2.push(model); yield { type: 'finish', reason: { kind: 'stop' } }; } };
  await collect(createAutoAdapter(llm2, { scope: { models: ['drop'] } }).stream({ messages: user }));
  assert.deepEqual(calls2, ['drop']);
});

test('empty scope means all mounted candidates except Auto itself', async () => {
  const calls = [];
  const llm = { listProviders: () => [{ id: 'p' }, { id: 'model-aware-auto' }], listModels: async () => [{ id: 'auto' }, { id: 'model' }], async *stream({ model }) { calls.push(model); yield { type: 'finish', reason: { kind: 'stop' } }; } };
  await collect(createAutoAdapter(llm, { scope: {} }).stream({ messages: user }));
  assert.deepEqual(calls, ['model']);
});

test('fallback switches once only before any visible output', async () => {
  const calls = [];
  const llm = { listProviders: () => [{ id: 'p' }], listModels: async () => [{ id: 'first' }, { id: 'second' }], async *stream({ model }) { calls.push(model); yield { type: 'finish', reason: { kind: 'error', failure: { code: 'RATE_LIMIT', message: 'x' } } }; } };
  const out = await collect(createAutoAdapter(llm, { fallback: { maxAttempts: 1 } }).stream({ messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] }));
  assert.equal(calls.length, 2);
  assert.equal(out.at(-1).reason.kind, 'error');
});

test('fallback does not repeat after usage or tool output', async () => {
  let calls = 0;
  const llm = { listProviders: () => [{ id: 'p' }], listModels: async () => [{ id: 'one' }, { id: 'two' }], async *stream() { calls++; yield { type: 'usage', usage: { inputTokens: 1, outputTokens: 0 } }; yield { type: 'finish', reason: { kind: 'error', failure: { code: 'RATE_LIMIT', message: 'x' } } }; } };
  await collect(createAutoAdapter(llm, { fallback: { maxAttempts: 2 } }).stream({ messages: user }));
  assert.equal(calls, 1);
});
