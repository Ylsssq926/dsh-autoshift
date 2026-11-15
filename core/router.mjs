import { ROLES, DIMENSIONS, validateModelPool, unit, object, flag, text } from './profiles.mjs';

const REQUIREMENTS = {
  requiresTools: 'tools', requiresFreshWeb: 'web', requiresWorkspaceWrite: 'workspaceWrite',
  requiresLongHorizon: null, requiresIndependentVerification: null, requiresWriting: null,
};
const ROLE_DIMENSIONS = {
  implementer: ['coding', 'repositoryNavigation', 'multiFileConsistency', 'patchPrecision', 'failureRecovery'],
  architect: ['planning', 'largeProjectExecution', 'multiFileConsistency', 'constraintRetention'],
  tester: ['testDesign', 'verification', 'failureRecovery'],
  reviewer: ['verification', 'evidenceDiscipline', 'scopeDiscipline'],
  researcher: ['researchSynthesis', 'citationAccuracy', 'freshnessAwareness', 'uncertaintyCalibration'],
  creative: ['creativeGeneration', 'originality', 'styleControl', 'characterConsistency', 'repetitionControl'],
  writer: ['writing', 'styleControl', 'chineseWriting', 'constraintRetention'],
};
export function validateTaskProfile(input) {
  const task = object(input, 'task');
  text(task.id, 'task id');
  if (!ROLES.includes(task.role)) throw new Error('Unsupported task role');
  const risk = task.risk ?? 'medium';
  if (!['low', 'medium', 'high'].includes(risk)) throw new Error('Invalid task risk');
  const raw = object(task.requirements ?? {}, 'requirements');
  if (Object.keys(raw).some((key) => !Object.hasOwn(REQUIREMENTS, key))) throw new Error('Unknown task requirement');
  const requirements = Object.fromEntries(Object.keys(REQUIREMENTS).map((key) => [key, flag(raw[key], key === 'requiresIndependentVerification' && risk === 'high', key)]));
  const dimensionWeights = object(task.dimensionWeights ?? {}, 'dimension weights');
  if (Object.keys(dimensionWeights).some((key) => !DIMENSIONS.includes(key))) throw new Error('Unknown task dimension');
  for (const [key, value] of Object.entries(dimensionWeights)) unit(value, key);
  return { id: task.id, role: task.role, risk, requirements, dimensionWeights: { ...dimensionWeights }, objective: task.objective ?? '' };
}
function fit(profile, task) {
  const b = profile.behavior;
  let value = profile.roles[task.role];
  if (task.requirements.requiresTools) value *= .35 + .65 * b.toolPersistence;
  if (task.requirements.requiresFreshWeb) value *= .35 + .65 * b.freshnessAwareness;
  if (task.requirements.requiresLongHorizon) value *= .35 + .65 * b.largeProjectExecution;
  if (task.requirements.requiresWriting) value *= .35 + .65 * b.contextFollowing;
  if (task.requirements.requiresIndependentVerification) value *= .35 + .65 * b.evidenceDiscipline;
  if (task.risk === 'high') value *= .4 + .6 * b.verification;
  const weights = Object.keys(task.dimensionWeights).length ? task.dimensionWeights
    : Object.fromEntries([...(ROLE_DIMENSIONS[task.role] ?? []), ...(task.requirements.requiresTools ? ['functionCalling', 'completionDiscipline'] : [])].map((key) => [key, 1]));
  const active = Object.entries(weights).filter(([, weight]) => weight > 0);
  const known = active.filter(([key]) => profile.dimensions[key] != null);
  // Missing dimensions contribute no adjustment. Evidence is a bounded
  // correction, not another quality floor or a reason to add a model call.
  if (known.length) {
    const sum = active.reduce((n, [, weight]) => n + weight, 0);
    const adjustment = known.reduce((n, [key, weight]) => n + (profile.dimensions[key] - .5) * weight, 0) / sum;
    value = Math.min(1, value * (1 + .3 * adjustment));
  }
  return { suitability: value, knownDimensions: known.map(([key]) => key) };
}
export function routeTask(taskInput, pool, options = {}) {
  const task = validateTaskProfile(taskInput);
  const profiles = validateModelPool(pool).filter((profile) => profile.enabled);
  const minimum = unit(options.minimumSuitability ?? (task.risk === 'high' ? .55 : .35), 'minimum suitability');
  const costWeight = unit(options.costWeight ?? .12, 'cost weight');
  const latencyWeight = unit(options.latencyWeight ?? .04, 'latency weight');
  const availability = object(options.availability ?? {}, 'availability');
  const candidates = profiles.map((profile, priority) => {
    const runtime = Object.hasOwn(availability, profile.id) ? availability[profile.id] : undefined;
    const exclusions = [];
    if (runtime?.authorized !== true) exclusions.push('not-authorized');
    if (runtime?.available !== true) exclusions.push('not-available');
    for (const [key, capability] of Object.entries(REQUIREMENTS)) {
      if (capability && task.requirements[key] && runtime?.[capability] !== true) exclusions.push(`missing-${capability}`);
    }
    const { suitability, knownDimensions } = fit(profile, task);
    const score = suitability - costWeight * profile.economics.relativeCost - latencyWeight * profile.economics.latency;
    return {
      modelId: profile.id, provider: profile.provider, model: profile.model, priority,
      suitability, score, knownDimensions, exclusions,
      requiresExternalReviewer: task.requirements.requiresIndependentVerification || profile.constraints.requiresExternalReviewer,
      evidencePolicy: { ...profile.constraints },
    };
  }).sort((a, b) => b.score - a.score || b.suitability - a.suitability || a.priority - b.priority);
  const selected = candidates.find((candidate) => !candidate.exclusions.length && candidate.suitability >= minimum) ?? null;
  return { task, candidates, selected,
    reason: selected ? 'best-qualified-candidate' : !candidates.length ? 'no-enabled-models'
      : candidates.every((candidate) => candidate.exclusions.length) ? 'no-eligible-models' : 'no-model-meets-quality-floor' };
}
