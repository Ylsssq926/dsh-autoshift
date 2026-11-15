// Name-pattern heuristics for zero-config catalog discovery. A model ID only
// estimates a cost tier and a starter role — never a capability measurement,
// never a price quote, and never a reason to hide a model. Explicit routes and
// preferences always override these defaults.
export const TIERS = Object.freeze(['economy', 'standard', 'quality']);
export const TIER_ECONOMICS = Object.freeze({
  economy: Object.freeze({ relativeCost: .15, latency: .3 }),
  standard: Object.freeze({ relativeCost: .5, latency: .6 }),
  quality: Object.freeze({ relativeCost: 1, latency: 1 }),
});
const ECONOMY_TOKENS = new Set(['mini', 'flash', 'lite', 'haiku', 'nano', 'tiny', 'small', 'air', 'free', 'fast', 'turbo', 'spark', 'swift']);
// Reasoning markers (r1/o1/o3/o4/reasoner/thinking) are flagship-class.
const QUALITY_TOKENS = new Set(['pro', 'opus', 'ultra', 'max', 'plus', 'premium', 'flagship', 'large', 'reasoner', 'thinking', 'r1', 'o1', 'o3', 'o4']);
const ENGINEERING_TOKENS = new Set(['coder', 'code', 'codex', 'dev', 'programmer']);
const FAMILY_ROLES = new Map([['deepseek', 'implementer'], ['gemini', 'creative'], ['claude', 'implementer']]);

// Classification-only normalization. The exact catalog ID must still be used
// for forwarding; providers may be case- or suffix-sensitive.
export function normalizeModelId(model) {
  return String(model).trim().toLowerCase().split('/').pop()
    .replace(/:\w+$/, '')
    .replace(/[-_.](latest|preview|beta|stable|exp|experimental|\d{8}|\d{4}-\d{2}-\d{2})$/, '');
}

export function modelTier(model) {
  const tokens = normalizeModelId(model).split(/[^a-z0-9]+/).filter(Boolean);
  const has = (set) => tokens.some((token) => set.has(token));
  // Small open-weight parameter counts (<=9B) are cheap to serve.
  const smallParams = tokens.some((token) => /^\d+b$/.test(token) && Number.parseInt(token, 10) <= 9);
  // A cheap variant of a flagship family stays cheap: "pro-flash" is economy.
  // ":free" relay channels are stripped by normalization, so check them raw.
  const tier = String(model).trim().toLowerCase().endsWith(':free') || has(ECONOMY_TOKENS) || smallParams ? 'economy'
    : has(QUALITY_TOKENS) ? 'quality' : 'standard';
  const roles = ['general'];
  const familyRole = FAMILY_ROLES.get(tokens.find((token) => /^[a-z]+$/.test(token)));
  if (familyRole) roles.push(familyRole);
  if (has(ENGINEERING_TOKENS) && !roles.includes('implementer')) roles.push('implementer');
  return { tier, roles };
}

export function tierEconomics(model) {
  return { ...TIER_ECONOMICS[modelTier(model).tier] };
}