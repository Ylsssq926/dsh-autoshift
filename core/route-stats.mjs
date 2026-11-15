import { readAutoReplay } from './replay.mjs';
import { receiptOf } from './receipt.mjs';

// Counts Auto replies, not conversation turns: a tool-using turn can produce
// several assistant messages. No token or money totals here — those need the
// host usage event mapping and user-configured prices respectively.
export function summarizeRoutes(messages) {
  const byRoute = new Map();
  const byTier = {};
  const byRole = {};
  let replies = 0;
  let fallbacks = 0;
  for (const message of messages) {
    if (message?.role !== 'assistant') continue;
    const saved = readAutoReplay(message);
    if (!saved) continue;
    const receipt = receiptOf(saved);
    replies++;
    if (receipt.fallbackAttempt) fallbacks++;
    byTier[receipt.tier ?? 'unknown'] = (byTier[receipt.tier ?? 'unknown'] ?? 0) + 1;
    byRole[receipt.role] = (byRole[receipt.role] ?? 0) + 1;
    const key = JSON.stringify([receipt.provider, receipt.model]);
    const row = byRoute.get(key) ?? { provider: receipt.provider, model: receipt.model, tier: receipt.tier, replies: 0 };
    row.replies++;
    byRoute.set(key, row);
  }
  return { replies, fallbacks, byTier, byRole, byRoute: [...byRoute.values()].sort((a, b) => b.replies - a.replies) };
}