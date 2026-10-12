import type { DetectedLayout, DetectedLayoutKind } from './types.js';
import { LAYOUT_FENCE_MARKER } from './types.js';

// Opening fence, capture the kind and the body, and either the closing fence
// (group 3 = '```') or end-of-input (group 3 = '' → still streaming).
const FENCE_RE = /```layout:(html|markdown)[^\n]*\n([\s\S]*?)(```|$)/;

/**
 * Deterministic detection against the wire contract.
 *
 * The model must emit exactly one fenced code block whose info string starts
 * with ```${LAYOUT_FENCE_MARKER}``` (e.g. ```` ```layout:html ````). This
 * function searches for that fence and extracts the document body.
 *
 * **Chunk-tolerant**: safe to run on a live stream buffer. Returns
 * `complete: false` while the closing fence hasn't arrived yet, allowing your
 * UI to show a streaming preview.
 *
 * **Conservative fallback**: if the model drops the fence entirely but the
 * ENTIRE output is already a full HTML document (starts with `<!doctype html>`
 * or `<html>`), treat it as an HTML layout. The `fallback` flag is set to
 * `true` so you can distinguish this from normal fence-based detection if
 * needed. This fallback only triggers for *complete* documents — partial HTML
 * without a fence is ignored.
 *
 * @param text - The model's response text (full message or live stream buffer)
 * @returns A `DetectedLayout` describing what was found
 *
 * @example
 * // Normal fence-based detection
 * const hit = detectLayoutOutput('Here you go:\n```layout:html\n<!DOCTYPE html>...</html>\n```');
 * // → { kind: 'html', document: '<!DOCTYPE html>...</html>', complete: true }
 *
 * @example
 * // Streaming — closing fence hasn't arrived yet
 * const hit = detectLayoutOutput('lead-in\n```layout:html\n<!DOCTYPE html><html>');
 * // → { kind: 'html', document: '<!DOCTYPE html><html>', complete: false }
 *
 * @example
 * // Fallback — model dropped the fence but emitted complete HTML
 * const hit = detectLayoutOutput('<!DOCTYPE html><html><body>hi</body></html>');
 * // → { kind: 'html', document: '<!DOCTYPE html>...', complete: true, fallback: true }
 *
 * @example
 * // Plain text — no layout
 * const hit = detectLayoutOutput('Just a normal answer with `code` and text.');
 * // → { kind: 'none', document: '', complete: false }
 *
 * @example
 * // Streaming loop — run on every chunk
 * let accumulated = '';
 * for await (const chunk of textStream) {
 *   accumulated += chunk;
 *   const hit = detectLayoutOutput(accumulated);
 *   if (hit.kind === 'html') {
 *     if (hit.complete) finalizePreview(hit.document);
 *     else updateStreamingPreview(hit.document);
 *   }
 * }
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

// ─── streamed card shell (v0.1.1) ───

export interface LayoutStreamInfo {
  /** True once the opening fence line has arrived in the buffer. */
  started: boolean;
  preset: "html" | "markdown" | null;
  /** `variant=` token from the fence info string, when present. */
  variant?: string;
  /** `height=` token (px) from the fence info string, when present. */
  initialHeight?: number;
}

const DEFAULT_HEIGHTS: Record<"html" | "markdown", number> = { html: 420, markdown: 240 };

/**
 * Inspect a live stream buffer and describe the layout document it is
 * producing — as soon as the opening fence line arrives, before any content
 * streams. Hosts use this to render the card shell (chrome + placeholder at
 * `initialHeight`) while the document is still generating, so the frame
 * never pops in empty at the end.
 *
 * The info string may carry ` variant=<style>` and ` height=<px>` tokens:
 * ` ```layout:html variant=magazine height=520 `.
 */
export function describeLayoutStream(text: string): LayoutStreamInfo {
  const idx = text.indexOf("```" + LAYOUT_FENCE_MARKER);
  if (idx === -1) {
    // Whole-message-HTML fallback (no fence): treat as a streaming html doc.
    const trimmed = text.trim();
    if (/^<!doctype html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
      return { started: true, preset: "html", initialHeight: DEFAULT_HEIGHTS.html };
    }
    return { started: false, preset: null };
  }
  const lineEnd = text.indexOf("\n", idx);
  if (lineEnd === -1 && text.length < idx + 60) {
    // Fence marker seen but the info string is still arriving.
    return { started: true, preset: null };
  }
  const infoLine = (lineEnd === -1 ? text.slice(idx) : text.slice(idx, lineEnd)).trim();
  const kindMatch = infoLine.match(/^```layout:(html|markdown)\b/);
  if (!kindMatch) return { started: true, preset: null };
  const preset = kindMatch[1] as "html" | "markdown";
  const variantMatch = infoLine.match(/\bvariant=([\w-]+)/);
  const heightMatch = infoLine.match(/\bheight=(\d+)\b/);
  const variant = variantMatch?.[1];
  const initialHeight = heightMatch ? Math.max(120, Math.min(2000, Number(heightMatch[1]))) : DEFAULT_HEIGHTS[preset];
  return { started: true, preset, variant, initialHeight };
}
