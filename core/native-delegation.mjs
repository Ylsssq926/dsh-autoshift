// Adapt only complete, contiguous calls. Unrelated and interleaved chunks
// keep their original order; DSH remains the sole executor.
import { delegationRole } from './task-roles.mjs';
const MAX_CHARS = 8192;
export function shortHandoff(prompt, role) {
  const instruction = role === 'creative' || role === 'writer'
    ? 'Return the draft and any open choices.'
    : 'Report results, checks actually run, and remaining issues.';
  return `Task:\n${prompt}\n\nDelivery:\n${instruction}`;
}

async function rewrite(block, selectRoute, signal) {
  if (typeof block.arguments !== 'string' || block.arguments.length > MAX_CHARS) return block;
  let args;
  try { args = JSON.parse(block.arguments); } catch { return block; }
  if (!args || typeof args !== 'object' || Array.isArray(args) || typeof args.prompt !== 'string' || !args.prompt.trim()) return block;
  if (args.provider !== undefined || args.model !== undefined || args.reasoning_effort !== undefined) return block;
  const role = delegationRole(args.prompt);
  const route = await selectRoute({ role, needsTools: true, signal });
  signal?.throwIfAborted();
  if (!route) return block;
  return { ...block, arguments: JSON.stringify({ ...args, provider: route.provider, model: route.model, prompt: shortHandoff(args.prompt, role) }) };
}

export async function* routeNativeDelegations(stream, { tools = [], selectRoute, signal, names = ['subagent'], onRewrite } = {}) {
  const supported = new Set(tools.filter(({ name, parameters }) => names.includes(name) &&
    ['prompt', 'provider', 'model'].every((key) => parameters?.properties?.[key]?.type === 'string')).map(({ name }) => name));
  if (!supported.size) { yield* stream; return; }
  let pending;
  let assigned = false;
  for await (const chunk of stream) {
    if (pending) {
      if (chunk.index === pending.index && chunk.type === 'tool-call-delta') {
        pending.length += chunk.argumentsDelta?.length ?? 0;
        pending.chunks.push(chunk);
        if ((!chunk.name || supported.has(chunk.name)) && pending.length <= MAX_CHARS && pending.chunks.length <= 256) continue;
        yield* pending.chunks;
        pending = undefined;
        continue;
      }
      if (chunk.index === pending.index && chunk.type === 'block-end' && chunk.block?.type === 'tool-call' && supported.has(chunk.block.name)) {
        const original = chunk.block;
        let updated;
        try { updated = await rewrite(original, selectRoute, signal); }
        catch (error) { if (signal?.aborted) throw error; updated = original; }
        if (updated !== original) {
          assigned = true;
          onRewrite?.(original);
          yield pending.chunks[0];
          yield { type: 'tool-call-delta', index: chunk.index, id: updated.id, name: updated.name, argumentsDelta: updated.arguments };
          yield { ...chunk, block: updated };
        } else { yield* pending.chunks; yield chunk; }
        pending = undefined;
        continue;
      }
      yield* pending.chunks;
      pending = undefined;
    }
    if (!assigned && chunk.type === 'block-start' && chunk.blockType === 'tool-call') {
      pending = { index: chunk.index, chunks: [chunk], length: 0 };
      continue;
    }
    yield chunk;
  }
  if (pending) yield* pending.chunks;
}

export function restoreOriginalCalls(content, originals) {
  if (!Array.isArray(content) || !Array.isArray(originals) || !originals.length) return content;
  return content.map((block) => {
    if (block.type !== 'tool-call') return block;
    const entry = originals.find((item) => item?.id === block.id && item?.name === block.name && typeof item.arguments === 'string');
    return entry ? { ...block, arguments: entry.arguments } : block;
  });
}
