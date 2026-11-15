// Low-overhead delegation policy. It never starts a child by itself.
export const DELEGATION_ROLES = ['planner', 'researcher', 'architect', 'implementer', 'tester', 'reviewer', 'writer', 'creative'];
export function planDelegation({ role, complexity = 'simple', explicit = false, extraCallsUsed = 0, maxExtraCalls = 1 } = {}) {
  if (!DELEGATION_ROLES.includes(role)) throw new Error('Unsupported delegation role');
  if (!['simple', 'complex'].includes(complexity)) throw new Error('Invalid delegation complexity');
  if (!Number.isSafeInteger(extraCallsUsed) || extraCallsUsed < 0 || !Number.isSafeInteger(maxExtraCalls) || maxExtraCalls < 0) throw new Error('Invalid delegation budget');
  const eligible = explicit || complexity === 'complex';
  const allowed = eligible && extraCallsUsed < maxExtraCalls;
  return {
    delegate: allowed,
    reason: !eligible ? 'direct-execution-first' : allowed ? 'explicit-or-complex-task' : 'extra-call-budget-exhausted',
    maxExtraCalls,
    remainingExtraCalls: Math.max(0, maxExtraCalls - extraCallsUsed),
    role,
  };
}

export function buildDelegationRequest({ task, role, provider, model, backend, parent, signal, outputSchema, maxDepth = 1, cwd, handoff }) {
  if (!task || typeof task !== 'string' || !task.trim()) throw new Error('Delegated task is required');
  if (!parent || typeof parent.id !== 'string') throw new Error('A live parent agent is required');
  if (!signal) throw new Error('Delegation signal is required');
  if (typeof backend !== 'string' || !backend.trim()) throw new Error('A subagent backend is required');
  if (typeof provider !== 'string' || !provider || typeof model !== 'string' || !model) throw new Error('A concrete child model route is required');
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 0) throw new Error('Invalid delegation depth');
  const contract = handoff ? `\n\nHANDOFF CONTRACT:\n${JSON.stringify(handoff)}` : '';
  return {
    provider: backend, label: `auto:${role ?? 'task'}`,
    signal, delivery: 'caller',
    request: {
      parent, prompt: [{ type: 'text', text: `${task}${contract}` }],
      ...(cwd === undefined ? {} : { cwd }),
      agentOptions: { provider, model },
      ...(outputSchema === undefined ? {} : { outputSchema }),
      maxDepth,
    },
  };
}
