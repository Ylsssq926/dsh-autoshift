// Route receipt for Model Autoshift. The pure projection below mirrors
// core/replay.mjs + core/receipt.mjs; client.test.mjs guards against drift.
const AUTO_PROVIDER = 'model-aware-auto';
const AUTO_MODEL = 'auto';
const REPLAY_TAG = 'model-aware-auto/v1';

function readAutoReplay(message) {
  if (message.role !== 'assistant' || message.source?.provider !== AUTO_PROVIDER || message.source?.model !== AUTO_MODEL) return undefined;
  const saved = message.source.replayState?.response;
  if (saved?.tag !== REPLAY_TAG || typeof saved.provider !== 'string' || !saved.provider ||
      typeof saved.model !== 'string' || !saved.model || (saved.routeRevision !== undefined && typeof saved.routeRevision !== 'string')) return undefined;
  if (saved.routeView !== undefined && (typeof saved.routeView !== 'object' || saved.routeView.provider !== saved.provider || saved.routeView.model !== saved.model)) return undefined;
  return saved;
}

function receiptOf(saved) {
  const view = saved.routeView ?? {};
  return {
    provider: saved.provider,
    model: saved.model,
    role: typeof view.role === 'string' && view.role ? view.role : 'general',
    mode: typeof view.mode === 'string' && view.mode ? view.mode : 'balanced',
    tier: typeof view.tier === 'string' && view.tier ? view.tier : null,
    fallbackAttempt: Number.isSafeInteger(view.fallbackAttempt) && view.fallbackAttempt > 0 ? view.fallbackAttempt : 0,
    ...(saved.routeRevision === undefined ? {} : { routeRevision: saved.routeRevision }),
  };
}

function turnReceipt(messages) {
  const last = messages.findLast((message) => message?.role === 'assistant');
  const saved = last && readAutoReplay(last);
  return saved ? receiptOf(saved) : null;
}

const TIER_LABELS = {
  zh: { economy: '经济档', standard: '标准档', quality: '旗舰档' },
  en: { economy: 'economy', standard: 'standard', quality: 'flagship' },
};
const ROLE_LABELS = {
  general: '通用', implementer: '工程', creative: '创意', writer: '写作', tester: '测试',
  reviewer: '审查', researcher: '研究', architect: '架构', planner: '规划', finisher: '收尾',
};

function receiptLabel(receipt, locale = 'en') {
  const zh = String(locale).startsWith('zh');
  const parts = ['Auto', receipt.model];
  if (receipt.tier) parts.push((zh ? TIER_LABELS.zh : TIER_LABELS.en)[receipt.tier] ?? receipt.tier);
  parts.push(zh ? ROLE_LABELS[receipt.role] ?? receipt.role : receipt.role);
  if (receipt.fallbackAttempt) parts.push(zh ? `备选×${receipt.fallbackAttempt}` : `fallback×${receipt.fallbackAttempt}`);
  return parts.join(' · ');
}

window.__ModuleLoader__.load({
  id: 'model-aware-auto',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    return {
      inject: ['slots', 'sessions', 'locale'],
      apply(ctx) {
        function RouteReceipt(props) {
          const [locale, setLocale] = React.useState(ctx.locale.getSnapshot().active);
          React.useEffect(() => ctx.locale.subscribe(() => setLocale(ctx.locale.getSnapshot().active)), []);
          const [receipt, setReceipt] = React.useState(null);
          React.useEffect(() => {
            const source = ctx.sessions.binding(props.sessionId)?.eventSource;
            if (!source?.getSnapshot) return undefined;
            const update = () => {
              const entries = source.getSnapshot()?.entries || [];
              const messages = entries
                .filter((entry) => entry.type === 'event' && entry.event?.type === 'assistant/message'
                  && (typeof entry.event.seq !== 'number' || typeof props.seq !== 'number' || entry.event.seq <= props.seq))
                .map((entry) => entry.event.data?.message);
              setReceipt(turnReceipt(messages));
            };
            update();
            return typeof source.subscribe === 'function' ? source.subscribe(update) : undefined;
          }, [props.sessionId, props.seq]);
          if (!receipt) return null;
          return h('div', {
            className: 'maa-route-receipt',
            title: `${receipt.provider} · ${receipt.mode}`,
            style: { fontSize: 12, marginTop: 4, color: 'var(--dsw-alias-label-secondary)', userSelect: 'text' },
          }, receiptLabel(receipt, locale));
        }
        ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
          name: 'conversation.chat.turnTail', id: 'model-aware-auto-route-receipt', order: 10,
        }, RouteReceipt));
      },
    };
  },
});