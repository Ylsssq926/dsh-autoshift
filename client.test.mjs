import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { readAutoReplay } from './core/replay.mjs';
import { receiptOf, turnReceipt, receiptLabel } from './core/receipt.mjs';
import { autoMessage, foreignMessage, userMessage } from './test-fixtures.mjs';

const source = readFileSync(new URL('./client.js', import.meta.url), 'utf8');
// vm results live in another realm; normalize before strict deepEqual.
const norm = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
function loadClient() {
  let module;
  const context = { window: { __ModuleLoader__: { load: (row) => { module = row; } } } };
  const pure = runInNewContext(`${source}\n[readAutoReplay, receiptOf, turnReceipt, receiptLabel]`, context, { timeout: 1000 });
  return { module, pure };
}

test('client pure projection stays identical to core on every fixture', () => {
  const { pure } = loadClient();
  const [clientRead, clientReceipt, clientTurn, clientLabel] = pure;
  const messages = [
    autoMessage({ role: 'implementer', mode: 'economy', tier: 'economy', fallbackAttempt: 1 }),
    autoMessage(undefined),
    autoMessage({}, { routeRevision: 'r2' }),
    foreignMessage, userMessage,
    { role: 'assistant', content: [] },
    { role: 'assistant', content: [], source: { provider: 'model-aware-auto', model: 'auto' } },
    { role: 'assistant', content: [], source: { provider: 'model-aware-auto', model: 'auto', replayState: { response: { tag: 'wrong', provider: 'p', model: 'm' } } } },
    { role: 'assistant', content: [], source: { provider: 'model-aware-auto', model: 'auto', replayState: { response: { tag: 'model-aware-auto/v1', provider: 'p', model: 'm', routeView: { provider: 'other', model: 'm' } } } } },
  ];
  for (const message of messages) {
    assert.deepEqual(norm(clientRead(message)), readAutoReplay(message));
    const saved = readAutoReplay(message);
    if (saved) assert.deepEqual(norm(clientReceipt(saved)), receiptOf(saved));
  }
  for (const list of [[], messages, [autoMessage({}), foreignMessage], [foreignMessage, autoMessage({})], [userMessage]]) {
    assert.deepEqual(norm(clientTurn(list)), turnReceipt(list));
  }
  const receipt = receiptOf(autoMessage({ role: 'creative', tier: 'quality', fallbackAttempt: 2 }).source.replayState.response);
  for (const locale of ['zh', 'zh-CN', 'en', 'fr']) assert.equal(clientLabel(receipt, locale), receiptLabel(receipt, locale));
  assert.equal(clientLabel(receiptOf(autoMessage(undefined).source.replayState.response), 'zh'), receiptLabel(receiptOf(autoMessage(undefined).source.replayState.response), 'zh'));
});

function makeReact() {
  const states = []; let cursor = 0; const effects = [];
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (initial) => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], (value) => { states[i] = value; }]; },
    useEffect: (fn) => { effects.push(fn); },
  };
  const render = (Component, props) => {
    states.length = 0; cursor = 0; Component(props);
    for (const fn of effects.splice(0)) fn();
    cursor = 0; return Component(props);
  };
  return { React, render };
}

test('client registers the turnTail receipt and filters by turn seq', () => {
  const { module } = loadClient();
  assert.equal(module.id, 'model-aware-auto');
  const { React, render } = makeReact();
  const registered = [];
  const entries = [
    { type: 'event', event: { type: 'assistant/message', seq: 5, data: { message: autoMessage({ role: 'general', tier: 'economy', mode: 'economy' }) } } },
    { type: 'event', event: { type: 'assistant/message', seq: 9, data: { message: foreignMessage } } },
  ];
  const ctx = {
    slots: {
      inject: (name, fn) => { assert.equal(name, 'conversation.chat.turnTail'); fn(); },
      register: (meta, component) => registered.push({ meta, component }),
    },
    sessions: { binding: (id) => id === 's' ? { eventSource: { getSnapshot: () => ({ entries }), subscribe: () => () => {} } } : undefined },
    locale: { getSnapshot: () => ({ active: 'zh' }), subscribe: () => () => {} },
  };
  const client = module.factory((name) => { assert.equal(name, 'react'); return React; });
  assert.deepEqual(norm(client.inject), ['slots', 'sessions', 'locale']);
  client.apply(ctx);
  assert.equal(registered.length, 1);
  assert.equal(registered[0].meta.id, 'model-aware-auto-route-receipt');
  const Receipt = registered[0].component;
  const first = render(Receipt, { sessionId: 's', seq: 5 });
  assert.equal(first.children[0], 'Auto · gpt-5.4-mini · 经济档 · 通用');
  assert.equal(first.props.title, 'relay · economy');
  assert.equal(render(Receipt, { sessionId: 's', seq: 9 }), null);
  assert.equal(render(Receipt, { sessionId: 'missing', seq: 5 }), null);
  assert.equal(render(Receipt, {}), null);
});