import type { HtmlLayoutVariant, VisualLayoutSpec } from './types.js';
import { LAYOUT_FENCE_MARKER } from './types.js';

/**
 * Variant paragraph banks.
 *
 * Adding a new style = adding a new entry here; nothing else in the SDK or any
 * host needs to change. The paragraph bank is interpolated into the system
 * prompt by `buildSystemPromptFragment`, so each variant is just a different
 * set of style instructions for the model.
 *
 * Each bank describes:
 * - The layout structure (header, body, footer sections)
 * - Interactive elements the model may use (tabs, accordions, checklists, etc.)
 * - Any host-consumable attributes (e.g., `data-action-targets` for guide)
 *
 * @private
 */
const VARIANT_BANKS: Record<HtmlLayoutVariant, string> = {
  magazine: `### Layout style: magazine — editorial feature piece
- Full-bleed hero image with a dark gradient shade, kicker (small caps, brand color), display headline (tight letter-spacing), standfirst, and a byline/meta strip.
- Two-column body: main prose column with a pull quote (brand-tinted, left rule), side column of image figures with captions.
- Draw charts as inline <svg> (bars/lines with axis labels) — never chart libraries.
- Optional video section as a click-to-load cover card (dark cover, play glyph, title overlay).
- Close with a footer meta strip (author, read time, updated date).`,

  portfolio: `### Layout style: portfolio — case study
- Header on a subtle brand-tint gradient: kicker, project title, one-paragraph role/scope summary.
- A 4-up stat card row (metric + label) directly under the header.
- Image grid (mixed aspect ratios, subtle hover zoom), then prose sections with skill chips (rounded pills) and a testimonial card on a soft surface.`,

  interactive: `### Layout style: interactive — explorable guide
- Lead with a pill-style tab bar; each tab panel uses plain HTML + minimal inline JS for switching.
- Numbered step lists, <details>/<summary> accordions with styled markers, and a small image gallery grid with hover zoom.
- Every interactive element must work without any external script; inline JS only for tab/accordion/carousel behavior.`,

  research: `### Layout style: research — evidence review
- Header with title, meta row (compiler, sources screened, date) and an overall-confidence badge; then an Abstract panel (soft surface, brand left rule).
- Finding cards in a grid, each with its own confidence badge (<span data-conf="high|moderate|low">): the badge grades SOURCE QUALITY, not truth.
- Inline citations as small pill superscripts with hover tooltips carrying the underlying study, sample size, and caveats (title attribute or CSS-only tooltip).
- An evidence matrix table (Claim | Support | Source | Confidence), a collapsed methodology section, and a numbered references list at the end.`,

  workbook: `### Layout style: workbook — day-to-day decision doc
- Open with TL;DR cards (recommendation / effort / risk) so the answer leads.
- Callout blocks in three flavors (info, warning, success) with icon + bold lead-in; dotted-underline term tooltips for jargon.
- A comparison table with the recommended row visually highlighted (brand tint + left accent bar) and pill badges on key cells.
- An interactive click-to-check list for next actions, collapsible deep-dive sections, and a sources strip (chips) at the bottom.`,

  feed: `### Layout style: feed — multi-platform source board (resources, not conclusions)
- Framing is explicit: you curate RESOURCES the user verifies; state this in an opening info callout. Confidence labels grade source quality, never truth.
- TL;DR cards re-framed as "start here" pointers (best primary signal / key caveat / time to verify).
- Video sources as click-to-load cover cards with a platform badge (YouTube, Vimeo, …) and a note on where in the video the evidence lives.
- An image carousel (prev/next + dots) for related visuals; social/source cards for each platform — X, TikTok, Instagram, Threads, Reddit (r/ badge), Hacker News (Y badge), Facebook — each with handle, snippet, engagement numbers, a source-quality badge, and an "Open on <platform>" link.
- A source ledger table (Source | Platform | Type | What it supports) and a closing "verify tip" callout: for each row, try to find one source that contradicts it.
- Include an animated SVG verification workflow (Claim → Trace origin → Find primary → Check context → Verdict).`,

  guide: `### Layout style: guide — instructional module
- Kicker + title + meta (duration, step count, level); an outcomes box and a prerequisites box side by side; a live progress meter.
- Systems/workflow diagrams as ANIMATED inline SVG: a path with marching dashes (CSS stroke-dashoffset animation), a traveling dot (SMIL animateMotion), pulsing nodes. No JS required for the diagram.
- Steps as numbered items, each with its own mark-done control and a shared progress meter that updates via a few lines of inline JS.
- Knowledge-check quizzes: clickable options that mark right/wrong and reveal an explanation.
- End with a completion certificate section (<section data-guide-certificate>), locked until every step is marked done: seal graphic, module title, completion date, verifier name — then the ACTION ITEMS list.
- ACTION ITEMS contract: each item is an element carrying data-action-targets="<space-separated list>", listing ONLY the apps this item makes sense for. Allowed targets: tasks, calendar, notes. Example: <li data-action-targets="calendar tasks">Schedule 30 minutes this week…</li>. The host renders add-to-app buttons from these attributes; do not invent targets that don't fit the item.`,
};

const MARKDOWN_BANK = `### Layout style: document — clean typographic prose
- A markdown document (no HTML fence wrapper needed beyond the contract): title, byline, h2 sections, tables, blockquotes, and fenced code blocks.
- Restrained styling only: this preset is for prose that reads well in the document editor.`;

/**
 * Build the system-prompt instructions for what the generated document may load.
 *
 * The returned lines are interpolated into the prompt fragment by
 * `buildSystemPromptFragment`. This function is the heart of the "drift guard":
 * the SAME policy that controls the prompt also controls what the host's iframe
 * CSP allows. If you ever diverge these two, the model may promise something
 * the sandbox forbids — which breaks the security contract.
 *
 * @param spec - The visual layout spec whose policy to encode
 * @returns An array of bullet-point strings describing image/embed rules
 * @private
 */
function policyText(spec: VisualLayoutSpec): string[] {
  const lines: string[] = [];
  if (spec.outputPolicy.allowRemoteImages) {
    lines.push(
      '- Images: real remote <img> URLs are allowed (descriptive alt text, captions, attribution); at most 3 per section. Do not hotlink tiny thumbnails or trackers.'
    );
  } else {
    lines.push(
      '- Images: remote images are NOT allowed in this session. Use inline <svg> illustrations and CSS-drawn visuals instead.'
    );
  }
  if (spec.outputPolicy.allowEmbeds) {
    lines.push(
      '- Embeds: video/social embeds are allowed ONLY as click-to-load cover cards (static cover, play glyph, platform badge, title) that swap in the real <iframe> on user click. Never autoplay, never load an embed before the user clicks.'
    );
  } else {
    lines.push(
      '- Embeds: iframes and third-party embeds are NOT allowed in this session. Represent video/social sources as static styled cards (platform badge, title, "open on <platform>" link) with no <iframe>.'
    );
  }
  return lines;
}

/**
 * Build the system-prompt fragment for the given spec.
 *
 * This is the **single source of truth** for what the model is told about the
 * visual layout capability. Hosts inject the returned string into their system
 * prompt or system context block before each turn.
 *
 * When `spec.enabled` is `false`, returns an empty string — safe to always
 * append without conditional logic:
 *
 * ```ts
 * systemPrompt += '\n\n' + buildSystemPromptFragment(spec);
 * ```
 *
 * The fragment contains:
 * 1. A header declaring the active preset and variant (or "document" for markdown)
 * 2. A paragraph bank describing the layout style (one of 7 HTML variants, or the markdown style)
 * 3. The output contract: exactly one fenced code block with the correct info string
 * 4. Resource policy rules derived from `spec.outputPolicy` (the drift guard)
 *
 * @param spec - The complete visual layout spec controlling style and policy
 * @returns A non-empty string describing the layout style and output contract,
 *          or `''` when the capability is disabled
 *
 * @example
 * // Enable the workbook variant
 * const spec: VisualLayoutSpec = {
 *   enabled: true,
 *   preset: 'html',
 *   variant: 'workbook',
 *   outputPolicy: { allowRemoteImages: true, allowEmbeds: false },
 * };
 * const fragment = buildSystemPromptFragment(spec);
 * // → '## Visual Layout active — preset: html · style: workbook\n\n...'
 *
 * @example
 * // Markdown preset — no variant needed
 * const spec: VisualLayoutSpec = {
 *   enabled: true,
 *   preset: 'markdown',
 *   outputPolicy: { allowRemoteImages: false, allowEmbeds: false },
 * };
 * const fragment = buildSystemPromptFragment(spec);
 * // → '## Visual Layout active — preset: markdown\n\n...'
 *
 * @example
 * // Disabled — returns empty string
 * const spec: VisualLayoutSpec = { ...DEFAULT_SPEC, enabled: false };
 * const fragment = buildSystemPromptFragment(spec);
 * // → ''
 */
export function buildSystemPromptFragment(spec: VisualLayoutSpec): string {
  if (!spec.enabled) return '';

  if (spec.preset === 'markdown') {
    return `## Visual Layout active — preset: markdown

${MARKDOWN_BANK}

### Output contract
- Emit exactly one fenced code block with the info string \`\`\`${LAYOUT_FENCE_MARKER}markdown\`\`\` containing the complete document. A one-sentence lead-in before it is fine; nothing else after it.`.trim();
  }

  const variant = spec.variant ?? 'workbook';
  const bank = VARIANT_BANKS[variant];

  return `## Visual Layout active — preset: html · style: ${variant}

${bank}

### Output contract
- Emit exactly one fenced code block with the info string \`\`\`${LAYOUT_FENCE_MARKER}html\`\`\` containing a COMPLETE, self-contained HTML document (\`<!DOCTYPE html>\` through \`</html>\`). A one-sentence lead-in before it is fine; nothing else after it.
- All CSS in a single <style> block in the head. No external stylesheets, no frameworks, no external scripts.
- Minimal inline JavaScript is permitted only for in-document interactions (tabs, accordions, carousels, mark-done meters, click-to-load covers, quiz feedback). No network calls beyond image/embed loading.
- Responsive: flexbox/grid with media queries; readable at 320px and comfortable at 900px.
- Semantic HTML5 (article, section, figure, figcaption, header, footer); typography-first: tight display letter-spacing, restrained radii, soft shadows, one accent color.
${policyText(spec).join('\n')}`.trim();
}
