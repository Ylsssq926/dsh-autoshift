import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeRoutes } from './core/route-stats.mjs';
import { autoMessage, foreignMessage as foreign, userMessage as user } from './test-fixtures.mjs';

test('summarizeRoutes counts Auto replies by route, tier and role', () => {
  const cheap = autoMessage({ role: 'general', tier: 'economy' });
  const flagship = autoMessage({ role: 'implementer', tier: 'quality', fallbackAttempt: 1 }, { model: 'relay-pro', provider: 'relay' });
  flagship.source.replayState.response.routeView.model = 'relay-pro';
  const stats = summarizeRoutes([user, cheap, foreign, cheap, flagship]);
  assert.equal(stats.replies, 3);
  assert.equal(stats.fallbacks, 1);
  assert.deepEqual(stats.byTier, { economy: 2, quality: 1 });
  assert.deepEqual(stats.byRole, { general: 2, implementer: 1 });
  assert.deepEqual(stats.byRoute, [
    { provider: 'relay', model: 'gpt-5.4-mini', tier: 'economy', replies: 2 },
    { provider: 'relay', model: 'relay-pro', tier: 'quality', replies: 1 },
  ]);
});

test('legacy replays without tier land in an explicit unknown bucket', () => {
  const stats = summarizeRoutes([autoMessage(undefined)]);
  assert.deepEqual(stats.byTier, { unknown: 1 });
  assert.equal(stats.byRoute[0].tier, null);
});

test('empty or non-Auto history produces zeroed stats, not errors', () => {
  assert.deepEqual(summarizeRoutes([]), { replies: 0, fallbacks: 0, byTier: {}, byRole: {}, byRoute: [] });
  assert.equal(summarizeRoutes([user, foreign]).replies, 0);
});