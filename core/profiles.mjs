// Shared by the installed bundle and the offline research package. No I/O.
export const PROFILE_VERSION = 2;
export const ROLES = Object.freeze(['general', 'planner', 'researcher', 'architect', 'implementer', 'tester', 'reviewer', 'writer', 'creative', 'finisher']);
export const TRAITS = Object.freeze(['creativeGeneration', 'writing', 'planning', 'coding', 'debugging', 'largeProjectExecution', 'verification', 'toolPersistence', 'freshnessAwareness', 'evidenceDiscipline', 'contextFollowing']);
export const DIMENSIONS = Object.freeze([
  ...TRAITS, 'repositoryNavigation', 'multiFileConsistency', 'patchPrecision', 'testDesign',
  'failureRecovery', 'functionCalling', 'parallelToolCalling', 'instructionFollowing',
  'structuredOutput', 'longContextRetrieval', 'longContextReasoning', 'constraintRetention',
  'researchSynthesis', 'citationAccuracy', 'uncertaintyCalibration', 'completionDiscipline',
  'scopeDiscipline', 'styleControl', 'characterConsistency', 'chineseWriting',
  'multilingualWriting', 'originality', 'repetitionControl',
]);
export function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${name}`);
  return value;
}
export function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${name}`);
  return value;
}
export function unit(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) throw new Error(`Invalid ${name}`);
  return value;
}
export function flag(value, fallback, name) {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new Error(`Invalid ${name}`);
  return value;
}
function vector(input, keys, fallback, name) {
  object(input, name);
  if (Object.keys(input).some((key) => !keys.includes(key))) throw new Error(`Unknown ${name} dimension`);
  return Object.fromEntries(keys.map((key) => [key, input[key] == null ? fallback : unit(input[key], `${name}.${key}`)]));
}
export function validateModelProfile(input) {
  object(input, 'profile');
  if (input.version !== undefined && ![1, PROFILE_VERSION].includes(input.version)) throw new Error('Unsupported profile version');
  const id = text(input.id, 'id');
  const provider = text(input.provider, 'provider');
  const model = text(input.model, 'model');
  const roles = vector(input.roles ?? {}, ROLES, 0, 'roles');
  const behavior = vector(input.behavior ?? {}, TRAITS, .5, 'behavior');
  // Unmeasured new dimensions remain null, not a fabricated 50% capability.
  const dimensions = vector(input.dimensions ?? {}, DIMENSIONS, null, 'dimensions');
  const constraints = object(input.constraints ?? {}, 'constraints');
  const allowedConstraints = ['mustUseToolsForClaims', 'mustRunTestsBeforeCompletion', 'mustNotClaimSuccessWithoutEvidence', 'requiresExternalReviewer'];
  if (Object.keys(constraints).some((key) => !allowedConstraints.includes(key))) throw new Error('Unknown constraint');
  const economics = object(input.economics ?? {}, 'economics');
  const evidence = object(input.evidence ?? {}, 'evidence');
  const confidence = evidence.confidence ?? 'assumed';
  if (!['assumed', 'inferred', 'observed'].includes(confidence)) throw new Error('Invalid evidence confidence');
  if (input.notes !== undefined && typeof input.notes !== 'string') throw new Error('Invalid notes');
  return {
    protocol: 'dsh-model-aware-auto/model-profile', version: PROFILE_VERSION,
    id, provider, model, roles, behavior, dimensions,
    constraints: Object.fromEntries(allowedConstraints.map((key) => [key, flag(constraints[key], key === 'mustNotClaimSuccessWithoutEvidence', key)])),
    economics: { relativeCost: unit(economics.relativeCost ?? 1, 'relativeCost'), latency: unit(economics.latency ?? 1, 'latency') },
    evidence: { source: evidence.source === undefined ? 'user-configured' : text(evidence.source, 'evidence.source'), confidence,
      ...(evidence.updatedAt === undefined ? {} : { updatedAt: text(evidence.updatedAt, 'evidence.updatedAt') }) },
    enabled: flag(input.enabled, true, 'enabled'), notes: input.notes ?? '',
  };
}
export function validateModelPool(profiles) {
  if (!Array.isArray(profiles)) throw new Error('Model pool must be an array');
  const ids = new Set();
  const routes = new Set();
  return profiles.map((input) => {
    const profile = validateModelProfile(input);
    const route = JSON.stringify([profile.provider, profile.model]);
    if (ids.has(profile.id) || routes.has(route)) throw new Error('Duplicate model id or route');
    ids.add(profile.id); routes.add(route);
    return profile;
  });
}
