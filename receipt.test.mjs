import test from 'node:test';
import assert from 'node:assert/strict';
import { receiptOf, turnReceipt, receiptLabel } from './core/receipt.mjs';
import { autoMessage, foreignMessage as foreign, userMessage as user } from './test-fixtures.mjs';

test('receiptOf projects a full routeView', () => {
  const receipt = receiptOf(autoMessage({ role: 'implementer', mode: 'economy', tier: 'economy', fallbackAttempt: 1 }).source.replayState.response);
  assert.deepEqual(receipt, { provider: 'relay', model: 'gpt-5.4-mini', role: 'implementer', mode: 'economy', tier: 'economy', fallbackAttempt: 1 });
});

test('legacy replays without routeView degrade to safe defaults, never crash', () => {
  const receipt = receiptOf(autoMessage(undefined).source.replayState.response);
  assert.deepEqual(receipt, { provider: 'relay', model: 'gpt-5.4-mini', role: 'general', mode: 'balanced', tier: null, fallbackAttempt: 0 });
});

test('invalid fallback counters and empty strings are normalized', () => {
  for (const fallbackAttempt of [-1, 1.5, '2', null]) {
    assert.equal(receiptOf(autoMessage({ fallbackAttempt }).source.replayState.response).fallbackAttempt, 0);
  }
  const receipt = receiptOf(autoMessage({ role: '', mode: '', tier: '' }).source.replayState.response);
  assert.equal(receipt.role, 'general');
  assert.equal(receipt.mode, 'balanced');
  assert.equal(receipt.tier, null);
});

test('routeRevision passes through only when present', () => {
  assert.equal(receiptOf(autoMessage({}, { routeRevision: 'r2' }).source.replayState.response).routeRevision, 'r2');
  assert.equal('routeRevision' in receiptOf(autoMessage({}).source.replayState.response), false);
});

test('turnReceipt reads the last assistant message of the turn', () => {
  const auto = autoMessage({ role: 'creative', tier: 'quality' });
  assert.equal(turnReceipt([user, auto]).role, 'creative');
  assert.equal(turnReceipt([auto, user]).role, 'creative');
  assert.equal(turnReceipt([auto, foreign]), null);
  assert.equal(turnReceipt([foreign, auto]).role, 'creative');
  assert.equal(turnReceipt([]), null);
  assert.equal(turnReceipt([user]), null);
});

test('labels are bilingual, omit missing tiers and mark fallbacks', () => {
  const receipt = { provider: 'relay', model: 'gpt-5.4-mini', role: 'implementer', mode: 'economy', tier: 'economy', fallbackAttempt: 0 };
  assert.equal(receiptLabel(receipt, 'zh-CN'), 'Auto · gpt-5.4-mini · 经济档 · 工程');
  assert.equal(receiptLabel(receipt, 'en'), 'Auto · gpt-5.4-mini · economy · implementer');
  assert.equal(receiptLabel({ ...receipt, fallbackAttempt: 1 }, 'zh'), 'Auto · gpt-5.4-mini · 经济档 · 工程 · 备选×1');
  assert.equal(receiptLabel({ ...receipt, tier: null }, 'zh'), 'Auto · gpt-5.4-mini · 工程');
  assert.equal(receiptLabel({ ...receipt, role: 'unknown-role' }, 'zh'), 'Auto · gpt-5.4-mini · 经济档 · unknown-role');
});

test('labels cover eight languages and fall back to English for unknown locales', () => {
  const receipt = { provider: 'relay', model: 'm', role: 'implementer', mode: 'economy', tier: 'economy', fallbackAttempt: 0 };
  assert.equal(receiptLabel(receipt, 'ja'), 'Auto · m · エコノミー · 実装');
  assert.equal(receiptLabel(receipt, 'ko'), 'Auto · m · 이코노미 · 구현');
  assert.equal(receiptLabel(receipt, 'fr'), 'Auto · m · éco · implémentation');
  assert.equal(receiptLabel(receipt, 'es'), 'Auto · m · económico · implementación');
  assert.equal(receiptLabel(receipt, 'de'), 'Auto · m · Economy · Implementierung');
  assert.equal(receiptLabel(receipt, 'ru'), 'Auto · m · эконом · реализация');
  assert.equal(receiptLabel(receipt, 'xx-YY'), 'Auto · m · economy · implementer');
  assert.equal(receiptLabel({ ...receipt, fallbackAttempt: 2 }, 'ja'), 'Auto · m · エコノミー · 実装 · 代替×2');
});