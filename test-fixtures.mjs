import { AUTO_PROVIDER, AUTO_MODEL, REPLAY_TAG } from './core/replay.mjs';

export const autoMessage = (view, extra = {}) => ({
  role: 'assistant', content: [],
  source: { kind: 'model', provider: AUTO_PROVIDER, model: AUTO_MODEL, replayState: { response: {
    tag: REPLAY_TAG, provider: 'relay', model: 'gpt-5.4-mini', ...extra,
    ...(view === undefined ? {} : { routeView: { provider: 'relay', model: 'gpt-5.4-mini', ...view } }),
  } } },
});
export const foreignMessage = { role: 'assistant', content: [], source: { kind: 'model', provider: 'other', model: 'x' } };
export const userMessage = { role: 'user', content: [{ type: 'text', text: 'hi' }] };