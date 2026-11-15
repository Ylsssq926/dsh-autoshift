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

const LABELS = {
  zh: {
    tier: { economy: '经济档', standard: '标准档', quality: '旗舰档' },
    role: { general: '通用', implementer: '工程', creative: '创意', writer: '写作', tester: '测试', reviewer: '审查', researcher: '研究', architect: '架构', planner: '规划', finisher: '收尾' },
    fallback: '备选×{n}',
  },
  en: {
    tier: { economy: 'economy', standard: 'standard', quality: 'flagship' },
    role: { general: 'general', implementer: 'implementer', creative: 'creative', writer: 'writer', tester: 'tester', reviewer: 'reviewer', researcher: 'researcher', architect: 'architect', planner: 'planner', finisher: 'finisher' },
    fallback: 'fallback×{n}',
  },
  ja: {
    tier: { economy: 'エコノミー', standard: 'スタンダード', quality: 'フラッグシップ' },
    role: { general: '汎用', implementer: '実装', creative: '創作', writer: '執筆', tester: 'テスト', reviewer: 'レビュー', researcher: '調査', architect: '設計', planner: '計画', finisher: '仕上げ' },
    fallback: '代替×{n}',
  },
  ko: {
    tier: { economy: '이코노미', standard: '스탠다드', quality: '플래그십' },
    role: { general: '일반', implementer: '구현', creative: '창작', writer: '작성', tester: '테스트', reviewer: '검토', researcher: '연구', architect: '아키텍처', planner: '계획', finisher: '마무리' },
    fallback: '대체×{n}',
  },
  fr: {
    tier: { economy: 'éco', standard: 'standard', quality: 'flagship' },
    role: { general: 'général', implementer: 'implémentation', creative: 'création', writer: 'rédaction', tester: 'test', reviewer: 'revue', researcher: 'recherche', architect: 'architecture', planner: 'planification', finisher: 'finition' },
    fallback: 'repli×{n}',
  },
  es: {
    tier: { economy: 'económico', standard: 'estándar', quality: 'insignia' },
    role: { general: 'general', implementer: 'implementación', creative: 'creación', writer: 'redacción', tester: 'prueba', reviewer: 'revisión', researcher: 'investigación', architect: 'arquitectura', planner: 'planificación', finisher: 'cierre' },
    fallback: 'respaldo×{n}',
  },
  de: {
    tier: { economy: 'Economy', standard: 'Standard', quality: 'Flaggschiff' },
    role: { general: 'allgemein', implementer: 'Implementierung', creative: 'Kreation', writer: 'Schreiben', tester: 'Test', reviewer: 'Review', researcher: 'Recherche', architect: 'Architektur', planner: 'Planung', finisher: 'Abschluss' },
    fallback: 'Ersatz×{n}',
  },
  ru: {
    tier: { economy: 'эконом', standard: 'стандарт', quality: 'флагман' },
    role: { general: 'общий', implementer: 'реализация', creative: 'творчество', writer: 'письмо', tester: 'тест', reviewer: 'ревью', researcher: 'исследование', architect: 'архитектура', planner: 'планирование', finisher: 'завершение' },
    fallback: 'резерв×{n}',
  },
};

function labelsFor(locale) {
  const lang = String(locale).toLowerCase();
  for (const key of Object.keys(LABELS)) if (lang.startsWith(key)) return LABELS[key];
  return LABELS.en;
}

export function receiptLabel(receipt, locale = 'en') {
  const labels = labelsFor(locale);
  const parts = ['Auto', receipt.model];
  if (receipt.tier) parts.push(labels.tier[receipt.tier] ?? receipt.tier);
  parts.push(labels.role[receipt.role] ?? receipt.role);
  if (receipt.fallbackAttempt) parts.push(labels.fallback.replace('{n}', receipt.fallbackAttempt));
  return parts.join(' · ');
}