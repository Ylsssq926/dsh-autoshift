import test from 'node:test';
import assert from 'node:assert/strict';
import { modelTier, normalizeModelId, tierEconomics, TIER_ECONOMICS } from './core/model-tiers.mjs';

test('economy tokens mark cheap variants across families', () => {
  for (const id of ['gpt-5.4-mini', 'gemini-2.5-flash', 'claude-haiku-4', 'relay-lite', 'some-model:free', 'qwen-turbo', 'glm-air', 'vendor/nano-chat']) {
    assert.equal(modelTier(id).tier, 'economy', id);
  }
});

test('quality tokens mark flagship variants', () => {
  for (const id of ['gpt-5.4-pro', 'claude-opus-4-6', 'gemini-3.1-pro-preview', 'relay-ultra', 'big-max', 'house-premium']) {
    assert.equal(modelTier(id).tier, 'quality', id);
  }
});

test('a cheap variant of a flagship family stays economy', () => {
  assert.equal(modelTier('gemini-2.5-pro-flash').tier, 'economy');
  assert.equal(modelTier('claude-opus-mini').tier, 'economy');
});

test('unfamiliar names stay standard with a general role, never filtered', () => {
  const { tier, roles } = modelTier(' totally-unknown-模型 ');
  assert.equal(tier, 'standard');
  assert.deepEqual(roles, ['general']);
  assert.deepEqual(modelTier('').roles, ['general']);
});

test('engineering tokens and the deepseek family add implementer', () => {
  for (const id of ['qwen3-coder', 'acme-code', 'deepseek-v4-flash', 'deepseek-v4-pro', 'relay-dev']) {
    assert.ok(modelTier(id).roles.includes('implementer'), id);
  }
  assert.ok(!modelTier('gpt-5.4').roles.includes('implementer'));
});

test('gemini family keeps a creative starter role without duplicating implementer', () => {
  assert.ok(modelTier('gemini-2.5-pro').roles.includes('creative'));
  const coder = modelTier('gemini-coder');
  assert.deepEqual(coder.roles, ['general', 'creative', 'implementer']);
  assert.deepEqual(modelTier('deepseek-coder').roles, ['general', 'implementer']);
});

test('vendor prefixes, case, date and channel suffixes do not change the tier', () => {
  assert.equal(modelTier('OpenAI/GPT-5.4-Mini:free').tier, 'economy');
  assert.equal(modelTier('relay/gpt-5.4-mini-20260101').tier, 'economy');
  assert.equal(modelTier('relay/gpt-5.4-mini-2026-01-01').tier, 'economy');
  assert.equal(modelTier('vendor/model-preview').tier, modelTier('vendor/model').tier);
  assert.equal(modelTier('vendor/model:latest').tier, modelTier('vendor/model').tier);
});

test('normalization is classification-only and lowercases the last path segment', () => {
  assert.equal(normalizeModelId('OpenAI/GPT-5.4-Mini:free'), 'gpt-5.4-mini');
  assert.equal(normalizeModelId('a/b/c-model'), 'c-model');
});

test('tier economics stay inside the unit interval and match the tier', () => {
  for (const economics of Object.values(TIER_ECONOMICS)) {
    assert.ok(economics.relativeCost >= 0 && economics.relativeCost <= 1);
    assert.ok(economics.latency >= 0 && economics.latency <= 1);
  }
  assert.deepEqual(tierEconomics('x-mini'), { ...TIER_ECONOMICS.economy });
  assert.deepEqual(tierEconomics('x-pro'), { ...TIER_ECONOMICS.quality });
  assert.deepEqual(tierEconomics('x'), { ...TIER_ECONOMICS.standard });
});

test('reasoning markers tier as flagship unless a cheap variant token wins', () => {
  for (const id of ['deepseek-reasoner', 'deepseek-r1', 'glm-4.6-thinking', 'o1-preview', 'o3']) {
    assert.equal(modelTier(id).tier, 'quality', id);
  }
  assert.equal(modelTier('o3-mini').tier, 'economy');
  assert.equal(modelTier('deepseek-r1-distill-qwen-7b').tier, 'economy');
});

test('small open-weight parameter counts tier as economy', () => {
  for (const id of ['qwen2.5-7b-instruct', 'llama-3.1-8b', 'gemma-2-9b', 'mistral-7b', 'qwen2.5-1.5b']) {
    assert.equal(modelTier(id).tier, 'economy', id);
  }
  for (const id of ['qwen-14b', 'llama-3.1-70b', 'mistral-large']) {
    assert.notEqual(modelTier(id).tier, 'economy', id);
  }
});

test('claude family adds an implementer starter role', () => {
  assert.ok(modelTier('claude-sonnet-4-5').roles.includes('implementer'));
  assert.deepEqual(modelTier('claude-3-5-haiku').roles, ['general', 'implementer']);
});