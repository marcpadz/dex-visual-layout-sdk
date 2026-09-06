import type { DetectedLayout, DetectedLayoutKind } from './types.js';
import { LAYOUT_FENCE_MARKER } from './types.js';

// Opening fence, capture the kind and the body, and either the closing fence
// (group 3 = '```') or end-of-input (group 3 = '' → still streaming).
const FENCE_RE = /```layout:(html|markdown)[^\n]*\n([\s\S]*?)(```|$)/;

/**
 * Deterministic detection against the wire contract: the model emits exactly
 * one fenced block whose info string starts with `layout:`. No heuristics on
 * partial text. Chunk-tolerant: safe to run on a live stream buffer — returns
 * complete:false while the closing fence hasn't arrived yet.
 *
 * Conservative fallback for models that drop the fence: if the ENTIRE output
 * is already a full HTML document, treat it as an html document.
 */
export function detectLayoutOutput(text: string): DetectedLayout {
  const m = text.match(FENCE_RE);
  if (m) {
    const kind = m[1] as Exclude<DetectedLayoutKind, 'none'>;
    return { kind, document: m[2], complete: m[3] === '```' };
  }

  const trimmed = text.trim();
  if (/^<!doctype html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return {
      kind: 'html',
      document: trimmed,
      complete: /<\/html>\s*$/i.test(trimmed),
      fallback: true,
    };
  }

  // A fence that opened but whose kind hasn't streamed in fully yet.
  if (text.includes('```' + LAYOUT_FENCE_MARKER)) {
    return { kind: 'html', document: '', complete: false };
  }

  return { kind: 'none', document: '', complete: false };
}
