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
 * Validate and normalize a generated layout document for the host's previewer:
 * size cap, image/embed inventory (the host builds its sandbox CSP from the
 * embed list), and guide-variant action items (data-action-targets contract).
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
