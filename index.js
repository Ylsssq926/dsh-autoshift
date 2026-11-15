import { ROLES, flag, object, text, validateModelPool } from './core/profiles.mjs';
import { routeTask } from './core/router.mjs';
import { day, resolveDimensions, validateObservation } from './core/evidence.mjs';
import { modelTier, tierEconomics } from './core/model-tiers.mjs';
import { classifyPrompt } from './core/task-roles.mjs';
import { AUTO_PROVIDER, AUTO_MODEL, REPLAY_TAG, readAutoReplay, routeView } from './core/replay.mjs';

import { routeNativeDelegations, restoreOriginalCalls } from './core/native-delegation.mjs';

export { AUTO_PROVIDER, AUTO_MODEL, readAutoReplay, routeView };
const roleKey = (key) => key === 'engineering' ? 'implementer' : key;
const MODEL = {
  provider: AUTO_PROVIDER, id: AUTO_MODEL, name: 'Auto', inputModalities: ['text'],
  description: 'One Auto gear for your whole model pool — the right model per task, zero extra calls.',
};

const MODE_WEIGHTS = {
  economy: { costWeight: .25, latencyWeight: .06 },
  balanced: { costWeight: .12, latencyWeight: .04 },
  quality: { costWeight: 0, latencyWeight: 0 },
};
const routeKey = ({ provider, model }) => JSON.stringify([provider, model]);
function defaultRoute(provider, model) {
  // Name patterns only estimate a tier and a starter role. Every discovered
  // model keeps a general score, so an unfamiliar ID is never treated as unfit.
  const roles = Object.fromEntries(modelTier(model).roles.map((role, index) => [role, index === 0 ? .8 : 1]));
  // The catalog does not certify tool support. Like a manual selection, the
  // discovered route receives the tools the host already chose for the session.
  return { provider, model, roles, tools: true, economics: tierEconomics(model),
    evidence: { source: 'name-pattern', confidence: 'inferred' } };
}
function roleScores(input) {
  if (Array.isArray(input)) {
    if (!input.length || input.some((key) => !ROLES.includes(roleKey(key)))) throw new Error('Invalid Auto roles');
    return Object.fromEntries(input.map((key) => [roleKey(key), 1]));
  }
  const entries = Object.entries(object(input, 'Auto roles'));
  if (!entries.length || new Set(entries.map(([key]) => roleKey(key))).size !== entries.length) throw new Error('Invalid or duplicate Auto roles');
  return Object.fromEntries(entries.map(([key, score]) => [roleKey(key), score]));
}

function readPool(config) {
  const routes = config.routes ?? [];
  if (!Array.isArray(routes)) throw new Error('Auto routes must be an array');
  return validateModelPool(routes.map((route) => {
    object(route, 'Auto route');
    if (route.provider === AUTO_PROVIDER) throw new Error('Auto routes cannot target Auto');
    const roles = route.roles ?? defaultRoute(route.provider, route.model).roles;
    return { ...route, id: route.id ?? routeKey(route), roles: roleScores(roles) };
  })).map((profile, index) => {
    const { tools, maxOutputTokens, contextWindow, routeRevision } = routes[index];
    for (const [key, value] of Object.entries({ maxOutputTokens, contextWindow })) {
      if (value !== undefined && (!Number.isSafeInteger(value) || value < 1)) throw new Error(`Invalid ${key}`);
    }
    if (contextWindow !== undefined && maxOutputTokens >= contextWindow) throw new Error('Output cap must be below the context window');
    if (routeRevision !== undefined) text(routeRevision, 'routeRevision');
    return { ...profile, tools: flag(tools, true, 'tools'), maxOutputTokens, contextWindow, routeRevision };
  });
}

function classify(messages) {
  const user = messages.findLast((message) => message.role === 'user' && (message.source === undefined || message.source.kind === 'user'));
  const content = Array.isArray(user?.content) ? user.content
    : typeof user?.content === 'string' ? [{ type: 'text', text: user.content }] : [];
  let prompt = '';
  for (const block of content) {
    if (block?.type === 'text' && typeof block.text === 'string') prompt += ` ${block.text.slice(0, 4000 - prompt.length)}`;
    if (prompt.length >= 4000) break;
  }
  return classifyPrompt(prompt);
}

const routeIdentity = ({ provider, model, routeRevision }) => ({ provider, model, ...(routeRevision === undefined ? {} : { routeRevision }) });
const sameRoute = (a, b) => Boolean(a && b && a.provider === b.provider && a.model === b.model && a.routeRevision === b.routeRevision);
const failure = (code, message, kind = 'error') => ({ type: 'finish', reason: { kind, failure: { code, message } } });

function considerMessage(state, message) {
  if (message?.role !== 'assistant') return;
  const saved = readAutoReplay(message);
  if (!saved || (state.pinned && !sameRoute(state.pinned, saved))) state.incompatible = true;
  else state.pinned ??= routeIdentity(saved);
}

export function createAutoAdapter(llm, config = {}, { getSession, getDefaultModel, today = () => new Date().toISOString().slice(0, 10) } = {}) {
  const mode = config.mode ?? 'balanced';
  if (!['economy', 'balanced', 'quality'].includes(mode)) throw new Error('Invalid Auto mode');
  const scope = object(config.scope ?? {}, 'Auto scope');
  const allowProviders = new Set(Array.isArray(scope.providers) ? scope.providers : []);
  const denyProviders = new Set(Array.isArray(scope.excludeProviders) ? scope.excludeProviders : []);
  const allowModels = new Set(Array.isArray(scope.models) ? scope.models.map((model) => typeof model === 'string' ? model : routeKey(model)) : []);
  const denyModels = new Set(Array.isArray(scope.excludeModels) ? scope.excludeModels.map((model) => typeof model === 'string' ? model : routeKey(model)) : []);
  if ([...allowProviders, ...denyProviders, ...allowModels, ...denyModels].some((value) => typeof value !== 'string' || !value.trim())) throw new Error('Auto scope entries must be non-empty strings');
  const inScope = (route) => (!allowProviders.size || allowProviders.has(route.provider)) && !denyProviders.has(route.provider) &&
    (!allowModels.size || allowModels.has(routeKey(route)) || allowModels.has(route.model)) && !denyModels.has(routeKey(route)) && !denyModels.has(route.model);
  const configuredPool = readPool(config).filter(inScope);
  const fallbackLimit = config.fallback?.maxAttempts ?? 0;
  if (!Number.isSafeInteger(fallbackLimit) || fallbackLimit < 0 || fallbackLimit > 2) throw new Error('Invalid Auto fallback maxAttempts');
  const explicitPool = configuredPool.length > 0;

  // Preferences refine discovered routes, so a missing economics entry keeps
  // the name-pattern tier estimate instead of silently ranking as flagship.
  const preferenceRoutes = (config.preferences ?? []).map((route) =>
    route && typeof route === 'object' && route.economics === undefined ? { ...route, economics: tierEconomics(route.model) } : route);
  const preferences = new Map(readPool({ routes: preferenceRoutes }).filter(inScope).map((route) => [routeKey(route), route]));
  const catalogs = new Map();
  function readCatalog(provider) {
    const previous = catalogs.get(provider);
    if (previous && (previous.pending || previous.expiresAt > Date.now())) return previous.result;
    const entry = { pending: true };
    let timer;
    const deadline = new Promise((resolve) => { timer = setTimeout(() => resolve([]), 2000); });
    const request = Promise.resolve().then(() => llm.listModels(provider)).then((models) => {
      if (!Array.isArray(models)) return [];
      const unique = new Map();
      for (const model of models) {
        if (typeof model?.id === 'string' && model.id.trim() && model.id.trim().toLowerCase() !== AUTO_MODEL) {
          const key = model.id.trim().toLowerCase();
          if (!unique.has(key)) unique.set(key, model.id);
        }
      }
      return [...unique.values()];
    }).catch(() => []);
    entry.result = Promise.race([request, deadline]).then((models) => {
      clearTimeout(timer);
      entry.pending = false;
      entry.expiresAt = Date.now() + (models.length ? 30_000 : 3_000);
      return models;
    });
    catalogs.set(provider, entry);
    return entry.result;
  }
  async function getPool(mounted, pinned, allMounted = mounted) {
    if (explicitPool) return configuredPool;
    for (const provider of catalogs.keys()) if (!allMounted.has(provider)) catalogs.delete(provider);
    const providers = pinned ? (mounted.has(pinned.provider) ? [pinned.provider] : []) : [...mounted];
    const groups = await Promise.all(providers.map(async (provider) => {
      const ids = await readCatalog(provider);
      return ids.map((model) => preferences.get(routeKey({ provider, model })) ??
        readPool({ routes: [defaultRoute(provider, model)] })[0]);
    }));
    return groups.flat().filter(inScope);
  }
  const enabled = configuredPool.filter((route) => route.enabled);
  const contextWindow = enabled.length && enabled.every((route) => route.contextWindow !== undefined)
    ? Math.min(...enabled.map((route) => route.contextWindow)) : undefined;
  const configuredEvidence = config.communityEvidence;
  let observations = [];
  if (configuredEvidence !== undefined) {
    object(configuredEvidence, 'community evidence');
    text(configuredEvidence.scope, 'community evidence scope');
    day(today());
    if (!Array.isArray(configuredEvidence.observations)) throw new Error('Expected community evidence observations');
    observations = configuredEvidence.observations.map(validateObservation);
  }
  // Derived cache keyed by exact live Session objects. Nothing is written to
  // a new log format; cold sessions recover from existing assistant events.
  const sessionStates = new WeakMap();
  function stateFor(session, messages) {
    let state = session && sessionStates.get(session);
    if (!state) {
      state = { cursor: 0, attempted: false, incompatible: false, pinned: undefined, livePin: undefined };
      if (session) sessionStates.set(session, state);
    }
    if (session) {
      const next = session.seq;
      for (const event of session.snapshotEvents(state.cursor, next)) {
        if (event.type === 'assistant/message') considerMessage(state, event.data.message);
        if (event.type === 'assistant/attempt') state.attempted = true;
        if (event.type === 'subagent/model-selection-policy' && state.childRoutes === undefined) {
          const routes = event.data?.allowedModels;
          if (Array.isArray(routes)) state.childRoutes = new Set(routes.map(routeKey));
        }
      }
      state.cursor = next;
    }
    for (const message of messages) considerMessage(state, message);
    if (state.livePin && state.pinned && !sameRoute(state.livePin, state.pinned)) state.incompatible = true;
    return state;
  }

  const info = (provider, model) => {
    if (provider !== AUTO_PROVIDER || model !== AUTO_MODEL) throw new Error('Unknown Auto model');
    return { ...MODEL, ...(contextWindow === undefined ? {} : { context: { contextWindow } }), inputModalities: [...MODEL.inputModalities] };
  };
  function selectRoute({ role = 'general', needsTools = false, longHorizon = false, mounted, pool, exclude = new Set() }) {
    const preferred = explicitPool ? undefined : getDefaultModel?.();
    const preferredIndex = preferred ? pool.findIndex((route) => sameRoute(route, preferred)) : -1;
    const orderedPool = preferredIndex > 0 ? [pool[preferredIndex], ...pool.filter((_, index) => index !== preferredIndex)] : pool;
    const asOf = observations.length ? day(today()) : undefined;
    const profiles = observations.length ? orderedPool.map((profile) => ({ ...profile,
      dimensions: resolveDimensions(profile, observations, configuredEvidence.scope, asOf),
    })) : orderedPool;
    const availability = Object.fromEntries(profiles.map((route) => [route.id, { authorized: true, available: mounted.has(route.provider) && !exclude.has(routeKey(route)), tools: route.tools }]));
    const choose = (taskRole) => routeTask({ id: 'auto-request', role: taskRole,
      requirements: { requiresTools: needsTools, requiresLongHorizon: longHorizon, requiresWriting: ['creative', 'writer'].includes(taskRole) },
    }, profiles, { availability, ...MODE_WEIGHTS[mode] }).selected;
    const adjacentRole = { tester: 'implementer', reviewer: 'implementer', writer: 'creative' }[role];
    const decision = choose(role) ?? (adjacentRole ? choose(adjacentRole) : null) ?? (role === 'general' ? null : choose('general'));
    return decision && pool.find((route) => route.id === decision.modelId);
  }
  const adapter = {
    async selectRouteForTask({ role = 'general', needsTools = true, longHorizon = false, allowedRoutes, signal } = {}) {
      signal?.throwIfAborted();
      if (!allowedRoutes?.size) return null;
      const mounted = new Set(llm.listProviders().map(({ id }) => id).filter((id) => id !== AUTO_PROVIDER));
      const allowedProviders = new Set([...allowedRoutes].map((key) => JSON.parse(key)[0]));
      const discoverable = new Set([...mounted].filter((provider) => allowedProviders.has(provider)));
      const pool = (explicitPool ? configuredPool : await getPool(discoverable, undefined, mounted)).filter((route) => allowedRoutes.has(routeKey(route)));
      signal?.throwIfAborted();
      return selectRoute({ role, needsTools, longHorizon, mounted, pool });
    },
    providerInfo: (id) => ({ id, name: 'Model Autoshift' }),
    providerRetryPolicy: () => ({ mode: 'normal', maxRetries: 0, initialDelayMs: 0, maxDelayMs: 0, jitterRatio: 0, retryableCodes: [] }),
    listModels: async () => [{ ...info(AUTO_PROVIDER, AUTO_MODEL), description: explicitPool ? MODEL.description : 'Automatically picks from the models already configured in DSH. No setup required.' }],
    resolveModel: async (provider, model) => info(provider, model),
    prepareCall: async (provider, model) => ({ model: info(provider, model), stream: adapter.stream }),
    imageRequestPricing: () => undefined,
    imageRequestTarget: (_provider, _model, image) => ({ width: image.width, height: image.height, maxBytes: image.bytes }),
    async *stream(options) {
      if (options.signal?.aborted) { yield failure('ABORTED', 'Auto request cancelled.', 'aborted'); return; }
      const session = options.sessionId && getSession?.(options.sessionId);
      if (getSession && !session) { yield failure('AUTO_SESSION_UNAVAILABLE', 'Auto needs a live DSH session; no provider was called.'); return; }
      const messages = options.messages ?? [];
      const state = stateFor(session, messages);
      let pinned = state.pinned ?? state.livePin;
      if (!pinned && session?.header?.origin === 'subagent') {
        const parent = getSession?.(session.header.parentSession);
        const inherited = parent && stateFor(parent, []);
        pinned = inherited && !inherited.incompatible ? inherited.pinned ?? inherited.livePin : undefined;
        if (!pinned) { yield failure('AUTO_PARENT_ROUTE_UNAVAILABLE', 'The parent conversation has no available Auto route. Select a specific model for this subagent in DSH.'); return; }
      }
      if (state.incompatible || (state.attempted && !pinned)) {
        yield failure('AUTO_NEW_SESSION_REQUIRED', 'This conversation has no compatible Auto route. Start a new conversation and select Auto.'); return;
      }
      // Native title/summary producers must never choose the initial route.
      if (options.purpose !== undefined && !state.pinned) {
        yield failure('AUTO_AUXILIARY_UNPINNED', 'No Auto route is bound yet for this auxiliary request.'); return;
      }
      const mounted = new Set(llm.listProviders().map(({ id }) => id).filter((id) => id !== AUTO_PROVIDER));
      const pool = explicitPool ? configuredPool : await getPool(mounted, pinned);
      if (options.signal?.aborted) { yield failure('ABORTED', 'Auto request cancelled.', 'aborted'); return; }
      const stillMounted = new Set(llm.listProviders().map(({ id }) => id));
      for (const id of mounted) if (!stillMounted.has(id)) mounted.delete(id);
      if (!pool.length && !pinned) { yield failure('AUTO_NO_MODEL', 'No text model is available. Add a model in DSH settings, then try again.'); return; }
      if (pinned && !pool.length) { yield failure('AUTO_PIN_UNAVAILABLE', 'The model bound to this conversation is no longer mounted. Select a specific model for this conversation, or start a new one.'); return; }
      const needsTools = Boolean(options.tools?.length || messages.some((message) => message.role === 'tool' || (Array.isArray(message.content) && message.content.some((block) => block.type === 'tool-call'))));
      const attempted = new Set();
      let fallbackAttempts = 0;
      while (true) {
        let selected;
        if (pinned) {
          selected = pool.find((route) => route.enabled && sameRoute(pinned, route) && mounted.has(route.provider) && !attempted.has(routeKey(route)) && (!needsTools || route.tools));
        } else {
          const { role, longHorizon } = classify(messages);
          selected = selectRoute({ role, needsTools, longHorizon, mounted, pool, exclude: attempted });
        }
        if (!selected) { yield failure('AUTO_NO_ROUTE', 'No model in the Auto pool fits this request; nothing was sent to any provider. Check your Auto scope and routes.'); return; }
        attempted.add(routeKey(selected));
        const { provider, model, maxOutputTokens } = selected;
        const identity = routeIdentity(selected);
        const forwarded = messages.map((message) => {
          if (message.role !== 'assistant') return message;
          const saved = readAutoReplay(message);
          return { ...message, content: restoreOriginalCalls(message.content, saved?.originalCalls),
            source: { kind: 'model', provider, model, ...(saved?.native === undefined ? {} : { replayState: saved.native }) } };
        });
        const downstream = { ...options, provider, model, messages: forwarded };
        if (maxOutputTokens !== undefined) downstream.maxTokens = Math.min(options.maxTokens ?? maxOutputTokens, maxOutputTokens);
        const originalCalls = [];
        const nativeStream = llm.stream(downstream);
        const delegationEnabled = config.delegation?.enabled !== false && options.purpose === undefined &&
          session?.header?.origin !== 'subagent' && state.childRoutes?.size;
        const routedStream = delegationEnabled ? routeNativeDelegations(nativeStream, {
          tools: options.tools ?? [], signal: options.signal,
          names: config.delegation?.toolNames ?? ['subagent'],
          onRewrite: (original) => originalCalls.push({ id: original.id, name: original.name, arguments: original.arguments }),
          selectRoute: ({ role, needsTools, longHorizon, signal }) => adapter.selectRouteForTask({ role, needsTools, longHorizon, signal, allowedRoutes: state.childRoutes }),
        }) : nativeStream;
        let emitted = false;
        let retry = false;
        for await (const chunk of routedStream) {
          if (chunk.type !== 'finish') { emitted = true; yield chunk; continue; }
          if (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted') {
            if (chunk.reason.kind === 'error' && !emitted && !pinned && fallbackAttempts < fallbackLimit) {
              fallbackAttempts++;
              retry = true;
              break;
            }
            yield { type: 'finish', reason: chunk.reason };
          } else {
            if (session && options.purpose === undefined) state.livePin ??= identity;
            yield { ...chunk, replayState: { response: { tag: REPLAY_TAG, ...identity, routeView: routeView({ provider, model, role: classify(messages).role, mode, fallbackAttempt: fallbackAttempts }),
              ...(originalCalls.length ? { originalCalls } : {}),
              ...(chunk.replayState === undefined ? {} : { native: chunk.replayState }) } } };
          }
          return;
        }
        if (retry) continue;
        yield failure('AUTO_INCOMPLETE_STREAM', 'The selected model ended without a final result; no fallback was attempted.');
        return;
      }
    },
  };
  return adapter;
}

export const inject = ['llm', 'sessions'];
export function apply(ctx, config) {
  const defaults = ctx.get('agentDefaultModel');
  let lastConcreteDefault;
  const getDefaultModel = () => {
    const selection = defaults?.currentSelection();
    if (selection?.provider && selection.provider !== AUTO_PROVIDER) lastConcreteDefault = selection;
    return lastConcreteDefault;
  };
  getDefaultModel();
  const adapter = createAutoAdapter(ctx.llm, config, {
    getSession: (id) => ctx.sessions.get(id),
    getDefaultModel,
  });
  ctx.llm.registerAdapter([AUTO_PROVIDER], adapter);
}
