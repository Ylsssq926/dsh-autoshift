import test from 'node:test';
import assert from 'node:assert/strict';
import { planDelegation, buildDelegationRequest } from './core/delegation.mjs';

test('direct execution is default and complex work gets one optional child budget', () => {
  assert.equal(planDelegation({ role: 'implementer' }).delegate, false);
  assert.equal(planDelegation({ role: 'implementer', complexity: 'complex' }).delegate, true);
  assert.equal(planDelegation({ role: 'tester', explicit: true, extraCallsUsed: 1 }).delegate, false);
});

test('delegation request is a short handoff with bounded depth', () => {
  const request = buildDelegationRequest({ task: 'Run the focused tests', role: 'tester', backend: 'local-fixture', provider: 'p', model: 'm', parent: { id: 's' }, signal: new AbortController().signal, handoff: { acceptanceChecks: ['tests-pass'] } });
  assert.equal(request.provider, 'local-fixture');
  assert.equal(request.request.agentOptions.provider, 'p');
  assert.equal(request.request.agentOptions.model, 'm');
  assert.equal(request.request.maxDepth, 1);
  assert.match(request.request.prompt[0].text, /HANDOFF CONTRACT/);
  assert.throws(() => buildDelegationRequest({ task: 'x', provider: 'p', model: 'm', parent: { id: 's' }, signal: new AbortController().signal }), /backend/);
});
