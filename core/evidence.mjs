import { DIMENSIONS, object, text, unit } from './profiles.mjs';

export const EVIDENCE_VERSION = 1;
const KINDS = ['benchmark', 'community', 'local'];
export function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Expected YYYY-MM-DD');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Invalid evidence date');
  return value;
}
export function validateObservation(input) {
  const row = object(input, 'observation');
  if (row.version !== EVIDENCE_VERSION || !KINDS.includes(row.kind) || !DIMENSIONS.includes(row.dimension)) throw new Error('Invalid observation version, kind or dimension');
  const observedOn = day(row.observedOn);
  const reviewAfter = day(row.reviewAfter);
  if (reviewAfter <= observedOn) throw new Error('Evidence review date must follow observation date');
  const source = text(row.source, 'source');
  if (row.kind !== 'local' && new URL(source).protocol !== 'https:') throw new Error('Public evidence needs an HTTPS source');
  const metric = object(row.metric, 'metric');
  if (!Number.isFinite(metric.value)) throw new Error('Invalid raw metric');
  if (row.samples !== undefined && (!Number.isSafeInteger(row.samples) || row.samples < 1)) throw new Error('Invalid sample count');
  return {
    version: EVIDENCE_VERSION, kind: row.kind, dimension: row.dimension, source,
    model: text(row.model, 'exact model'), provider: text(row.provider, 'exact provider'),
    scope: text(row.scope, 'scope'), method: text(row.method, 'method'), observedOn, reviewAfter,
    metric: { name: text(metric.name, 'metric name'), value: metric.value, unit: text(metric.unit, 'metric unit') },
    ...(row.samples === undefined ? {} : { samples: row.samples }),
    ...(row.calibration === undefined ? {} : { calibration: {
      score: unit(row.calibration?.score, 'calibrated score'), basis: text(row.calibration?.basis, 'calibration basis'),
    } }),
  };
}

// The user must opt into external evidence; unknown, expired or conflicting
// calibrated values cannot silently promote a route. Manual values always win.
export function resolveDimensions(profile, observations, scope, asOf) {
  const values = { ...profile.dimensions };
  const matching = new Map();
  for (const row of observations) {
    if (row.provider !== profile.provider || row.model !== profile.model || row.scope !== scope ||
        row.observedOn > asOf || row.reviewAfter <= asOf || !row.calibration) continue;
    if (!matching.has(row.dimension)) matching.set(row.dimension, new Set());
    matching.get(row.dimension).add(row.calibration.score);
  }
  for (const [dimension, scores] of matching) {
    if (values[dimension] == null && scores.size === 1) values[dimension] = scores.values().next().value;
  }
  return values;
}
