import { modelTier } from './model-tiers.mjs';

export const AUTO_PROVIDER = 'model-aware-auto';
export const AUTO_MODEL = 'auto';
export const REPLAY_TAG = 'model-aware-auto/v1';

export function readAutoReplay(message) {
  if (message.role !== 'assistant' || message.source?.provider !== AUTO_PROVIDER || message.source?.model !== AUTO_MODEL) return undefined;
  const saved = message.source.replayState?.response;
  if (saved?.tag !== REPLAY_TAG || typeof saved.provider !== 'string' || !saved.provider ||
      typeof saved.model !== 'string' || !saved.model || (saved.routeRevision !== undefined && typeof saved.routeRevision !== 'string')) return undefined;
  if (saved.routeView !== undefined && (typeof saved.routeView !== 'object' || saved.routeView.provider !== saved.provider || saved.routeView.model !== saved.model)) return undefined;
  return saved;
}

export function routeView({ provider, model, role = 'general', mode = 'balanced', fallbackAttempt = 0 }) {
  return { provider, model, role, mode, fallbackAttempt, tier: modelTier(model).tier };
}