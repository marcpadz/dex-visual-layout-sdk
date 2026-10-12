import type { LayoutActionItem, OutputPolicy, ParsedLayoutDocument } from './types.js';
import { DEFAULT_OUTPUT_POLICY } from './types.js';

const byteSize = (s: string): number => new TextEncoder().encode(s).length;

const stripTags = (html: string): string =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Validate and normalize a generated layout document for the host's previewer.
 *
 * Performs three checks:
 * 1. **Size validation**: rejects documents exceeding `policy.maxDocumentBytes`
 * 2. **Resource inventory**: counts `<img>` elements and extracts all `<iframe src>` URLs
 * 3. **Action item extraction**: finds elements with `data-action-targets` (guide variant contract)
 *
 * The embed inventory is the key output — host applications use it to build
 * the iframe's `frame-src` CSP directive. Never trust the model to declare its
 * own frame policies; always derive the CSP from `doc.embeds`.
 *
 * @param html - The raw HTML document body (from `DetectedLayout.document`)
 * @param policy - Output policy for size validation; defaults to `DEFAULT_OUTPUT_POLICY`
 * @returns A `ParsedLayoutDocument` with validation results and resource inventory
 *
 * @example
 * // Basic usage
 * const doc = parseLayoutDocument(hit.document, spec.outputPolicy);
 * if (!doc.ok) {
 *   console.error(`Invalid layout: ${doc.reason}`);
 *   return;
 * }
 *
 * @example
 * // Build CSP from embed inventory
 * const origins = [...new Set(doc.embeds.map(e => new URL(e.src).origin))];
 * const csp = `frame-src 'self' ${origins.join(' ')}`;
 *
 * @example
 * // Extract action items (guide variant)
 * for (const item of doc.actionItems) {
 *   console.log(`${item.text} → ${item.targets.join(', ')}`);
 * }
 *
 * @example
 * // Handle size rejection gracefully
 * if (doc.reason === 'too-large') {
 *   showWarning(`Document exceeded ${spec.outputPolicy.maxDocumentBytes} byte limit`);
 *   renderFallback(doc.html.slice(0, 2000) + '... [truncated]');
 * }
 */
export function parseLayoutDocument(
  html: string,
  policy: OutputPolicy = DEFAULT_OUTPUT_POLICY
): ParsedLayoutDocument {
  const max = policy.maxDocumentBytes ?? DEFAULT_OUTPUT_POLICY.maxDocumentBytes!;
  const size = byteSize(html);

  if (html.trim().length === 0) {
    return { ok: false, reason: 'empty', html, byteSize: 0, images: 0, embeds: [], actionItems: [] };
  }
  if (size > max) {
    return { ok: false, reason: 'too-large', html, byteSize: size, images: 0, embeds: [], actionItems: [] };
  }

  const images = (html.match(/<img\b/gi) ?? []).length;

  const embeds: { src: string }[] = [];
  const iframeRe = /<iframe\b[^>]*\bsrc=["']([^"']+)["']/gi;
  let im: RegExpExecArray | null;
  while ((im = iframeRe.exec(html)) !== null) embeds.push({ src: im[1] });

  const actionItems: LayoutActionItem[] = [];
  const itemRe = /<([a-z0-9]+)([^>]*\bdata-action-targets="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/gi;
  let am: RegExpExecArray | null;
  while ((am = itemRe.exec(html)) !== null) {
    const targets = am[3].split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
    const text = stripTags(am[4]);
    if (targets.length && text) actionItems.push({ text, targets });
  }

  return { ok: true, html, byteSize: size, images, embeds, actionItems };
}
