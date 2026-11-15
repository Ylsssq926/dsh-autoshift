import { readAutoReplay } from './replay.mjs';

// One receipt describes one Auto reply. `tier` is null for replays written
// before routeView carried it; labels simply omit the tier segment then.
export function receiptOf(saved) {
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

export function turnReceipt(messages) {
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

export function receiptLabel(receipt, locale = 'en') {
  const zh = String(locale).startsWith('zh');
  const parts = ['Auto', receipt.model];
  if (receipt.tier) parts.push((zh ? TIER_LABELS.zh : TIER_LABELS.en)[receipt.tier] ?? receipt.tier);
  parts.push(zh ? ROLE_LABELS[receipt.role] ?? receipt.role : receipt.role);
  if (receipt.fallbackAttempt) parts.push(zh ? `备选×${receipt.fallbackAttempt}` : `fallback×${receipt.fallbackAttempt}`);
  return parts.join(' · ');
}