import test from 'node:test';
import assert from 'node:assert/strict';
import { routeNativeDelegations } from './core/native-delegation.mjs';
const collect = async (stream) => { const out = []; for await (const chunk of stream) out.push(chunk); return out; };
const tool = { name: 'subagent', parameters: { type: 'object', properties: { prompt: { type: 'string' }, provider: { type: 'string' }, model: { type: 'string' } } } };

test('native subagent route fills omitted provider/model and shortens handoff', async () => {
  const chunks = [
    { type: 'block-start', index: 0, blockType: 'tool-call' },
    { type: 'tool-call-delta', index: 0, id: 'call', name: 'subagent', argumentsDelta: JSON.stringify({ prompt: '请在这个大工程中运行测试并报告结果' }) },
    { type: 'block-end', index: 0, block: { type: 'tool-call', index: 0, id: 'call', name: 'subagent', arguments: JSON.stringify({ prompt: '请在这个大工程中运行测试并报告结果' }) } },
    { type: 'finish', reason: { kind: 'tool-calls' } },
  ];
  const out = await collect(routeNativeDelegations((async function* () { yield* chunks; })(), { tools: [tool], selectRoute: async () => ({ provider: 'p', model: 'm' }) }));
  const block = out.find((item) => item.type === 'block-end').block;
  const args = JSON.parse(block.arguments);
  assert.equal(args.provider, 'p');
  assert.equal(args.model, 'm');
  assert.match(args.prompt, /Delivery:/);
});

test('explicit child route is never overwritten', async () => {
  const block = { type: 'tool-call', index: 0, id: 'call', name: 'subagent', arguments: JSON.stringify({ prompt: 'x', provider: 'given', model: 'given-model' }) };
  const chunks = [{ type: 'block-start', index: 0, blockType: 'tool-call' }, { type: 'block-end', index: 0, block }, { type: 'finish', reason: { kind: 'tool-calls' } }];
  const out = await collect(routeNativeDelegations((async function* () { yield* chunks; })(), { tools: [tool], selectRoute: async () => { throw new Error('must not select'); } }));
  assert.equal(JSON.parse(out[1].block.arguments).provider, 'given');
});

test('only one native child call is enhanced per parent stream', async () => {
  let selections = 0;
  const call = (index) => [
    { type: 'block-start', index, blockType: 'tool-call' },
    { type: 'block-end', index, block: { type: 'tool-call', id: String(index), name: 'subagent', arguments: '{"prompt":"draft a story"}' } },
  ];
  const out = await collect(routeNativeDelegations((async function* () { yield* [...call(0), ...call(1)]; })(), {
    tools: [tool], selectRoute: async () => { selections++; return { provider: 'p', model: 'm' }; },
  }));
  assert.equal(selections, 1);
  assert.equal(JSON.parse(out.find((chunk) => chunk.type === 'block-end' && chunk.index === 1).block.arguments).model, undefined);
});
