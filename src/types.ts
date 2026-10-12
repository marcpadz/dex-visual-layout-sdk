// dex-visual-layout-sdk — types, constants, and runtime shapes

/**
 * Prompt-text style variants of the single `html` preset.
 *
 * Each variant is a paragraph bank inside `buildSystemPromptFragment`. Adding a
 * new variant never changes code paths, renderer behavior, or the wire contract
 * — it only adds a new bank to the internal lookup table.
 *
 * | Variant | When to use |
 * |---|---|
 * | `'magazine'` | Editorial feature pieces with hero images, two-column body, inline SVG charts |
 * | `'portfolio'` | Case studies with stat cards, mixed-aspect image grids, skill chips, testimonials |
 * | `'interactive'` | Explorable guides with tab bars, numbered steps, accordions, hover-zoom galleries |
 * | `'research'` | Evidence reviews with confidence badges, citation tooltips, evidence matrix tables |
 * | `'workbook'` | Day-to-day decision docs with TL;DR cards, callouts, comparison tables, checklists |
 * | `'feed'` | Multi-platform source boards with click-to-load video covers, image carousels, social cards |
 * | `'guide'` | Instructional modules with animated SVG diagrams, step tracking, quizzes, completion certificates |
 */
export type HtmlLayoutVariant =
  | 'magazine'
  | 'portfolio'
  | 'interactive'
  | 'research'
  | 'workbook'
  | 'feed'
  | 'guide';

/**
 * Top-level preset selector.
 *
 * - `'html'` — produces a complete, self-contained HTML document (default).
 * - `'markdown'` — produces clean typographic prose; the model wraps output in
 *   ```` ```layout:markdown ```` instead of ```` ```layout:html ````.
 */
export type LayoutPreset = 'html' | 'markdown';

/**
 * Controls what resources the generated document may load.
 *
 * The SAME spec drives both the prompt instructions and the host's iframe
 * sandbox/CSP — this is the "drift guard": the model is never promised
 * something the preview forbids. Always derive your CSP from the same
 * `spec.outputPolicy` that was passed to `buildSystemPromptFragment`.
 *
 * @example
 * // Allow remote images but no embeds
 * const policy: OutputPolicy = {
 *   allowRemoteImages: true,
 *   allowEmbeds: false,
 * };
 *
 * // Allow everything including click-to-load video covers
 * const policy: OutputPolicy = {
 *   allowRemoteImages: true,
 *   allowEmbeds: true,
 *   maxDocumentBytes: 1_000_000, // 1 MB cap
 * };
 */
export interface OutputPolicy {
  /**
   * Whether the model may include real remote `<img>` URLs.
   *
   * When `false`, the prompt instructs the model to use inline `<svg>`
   * illustrations and CSS-drawn visuals instead. The host's CSP should
   * also restrict `img-src` to `'self'` and `data:` when this is false.
   *
   * @default true
   */
  allowRemoteImages: boolean;

  /**
   * Whether the model may include click-to-load video/social embeds.
   *
   * When `true`, the model may generate static cover cards (platform badge,
   * title, play glyph) that swap in a real `<iframe>` on user click. Never
   * autoplay — the cover card must be the first thing the user sees.
   *
   * When `false`, represent video/social sources as static styled cards with
   * an "Open on &lt;platform&gt;" link instead of an `<iframe>`.
   *
   * **Security note**: When deriving the iframe CSP, always add every embed
   * origin to `frame-src` — do not trust the model to declare its own policies.
   */
  allowEmbeds: boolean;

  /**
   * Hard cap on the generated document size in bytes (UTF-8 encoded).
   *
   * Documents exceeding this limit cause `parseLayoutDocument` to return
   * `{ ok: false, reason: 'too-large' }`. Fall back to showing raw text or a
   * summary instead of rendering the full document.
   *
   * @default 2_000_000 (2 MB)
   */
  maxDocumentBytes?: number;
}

/**
 * The single persistent state of the visual layout capability.
 *
 * JSON-serializable — hosts may mirror this as a small struct (e.g. a
 * ~30-line serde struct in Rust). Create it once at session start and pass it
 * through every SDK call.
 *
 * @example
 * // Enable the workbook variant with remote images allowed
 * const spec: VisualLayoutSpec = {
 *   enabled: true,
 *   preset: 'html',
 *   variant: 'workbook',
 *   outputPolicy: {
 *     allowRemoteImages: true,
 *     allowEmbeds: false,
 *     maxDocumentBytes: 500_000,
 *   },
 * };
 *
 * // Switch variants at runtime (e.g. user picks "research" from a dropdown)
 * const newSpec = { ...spec, variant: 'research' };
 */
export interface VisualLayoutSpec {
  /**
   * Whether the visual layout capability is active.
   *
   * When `false`, `buildSystemPromptFragment` returns `''` — you can keep the
   * same spec object around and toggle this flag without rebuilding anything.
   */
  enabled: boolean;

  /**
   * Document format preset.
   *
   * - `'html'` (default): complete, self-contained HTML document.
   * - `'markdown'`: clean typographic prose wrapped in a markdown fence.
   */
  preset: LayoutPreset;

  /**
   * Layout style variant. Required when `preset === 'html'`.
   *
   * Defaults to `'workbook'` when omitted, so you can safely create a spec
   * without explicitly setting this field:
   *
   * ```ts
   * const spec: VisualLayoutSpec = {
   *   enabled: true,
   *   preset: 'html',
   *   outputPolicy: { ... }, // variant defaults to 'workbook'
   * };
   * ```
   */
  variant?: HtmlLayoutVariant;

  /**
   * Resource policy governing what the generated document may load.
   *
   * This policy is the single source of truth — it drives both the prompt
   * instructions and the iframe CSP. Never maintain a separate policy for the
   * CSP; always derive it from this object.
   */
  outputPolicy: OutputPolicy;
}

/**
 * Stable, sorted list of all supported HTML variants.
 *
 * Use this for populating UI dropdowns, iterating for tests, or validating
 * user input:
 *
 * ```ts
 * if (!HTML_VARIANTS.includes(userChoice)) {
 *   throw new Error(`Unknown variant: ${userChoice}`);
 * }
 * ```
 */
export const HTML_VARIANTS: readonly HtmlLayoutVariant[] = [
  'magazine',
  'portfolio',
  'interactive',
  'research',
  'workbook',
  'feed',
  'guide',
];

/**
 * Default output policy — remote images allowed, no embeds, 2 MB size cap.
 *
 * Spread this into your spec to avoid repeating the boilerplate:
 *
 * ```ts
 * const spec: VisualLayoutSpec = {
 *   ...DEFAULT_SPEC,
 *   enabled: true,
 *   outputPolicy: { ...DEFAULT_OUTPUT_POLICY, allowEmbeds: true },
 * };
 * ```
 */
export const DEFAULT_OUTPUT_POLICY: OutputPolicy = {
  allowRemoteImages: true,
  allowEmbeds: false,
  maxDocumentBytes: 2_000_000,
};

/**
 * Default spec — disabled, html preset, workbook variant, default policy.
 *
 * Use as the base and spread overrides:
 *
 * ```ts
 * const spec: VisualLayoutSpec = {
 *   ...DEFAULT_SPEC,
 *   enabled: true,
 *   variant: 'guide',
 * };
 * ```
 */
export const DEFAULT_SPEC: VisualLayoutSpec = {
  enabled: false,
  preset: 'html',
  variant: 'workbook',
  outputPolicy: { ...DEFAULT_OUTPUT_POLICY },
};

/**
 * Wire contract marker: the model must emit exactly one fenced code block
 * whose info string starts with this value.
 *
 * Detection is deterministic against this marker — no heuristics. The regex
 * used by `detectLayoutOutput` is:
 *
 * ```regex
 * ```layout:(html|markdown)[^\n]*\n([\s\S]*?)(```|$)
 * ```
 *
 * Both ```` ```layout:html ```` and ```` ```layout:markdown ```` are valid.
 * Variations like ```` ``` layout:html ```` (space after fence) or
 * ```` ```Layout:HTML ```` (wrong case) will **not** match.
 */
export const LAYOUT_FENCE_MARKER = 'layout:';

/**
 * Kind of layout detected in model output.
 *
 * - `'html'`: The model produced (or is streaming) an HTML layout document.
 * - `'markdown'`: The model produced a markdown layout document.
 * - `'none'`: No layout detected — plain assistant text.
 */
export type DetectedLayoutKind = 'html' | 'markdown' | 'none';

/**
 * Result of detecting a layout document in model output.
 *
 * @example
 * const hit = detectLayoutOutput(responseText);
 * if (hit.kind === 'html') {
 *   if (hit.complete) {
 *     // Full document — validate and render
 *     const doc = parseLayoutDocument(hit.document, spec.outputPolicy);
 *   } else {
 *     // Streaming — show a skeleton or spinner
 *     showStreamingPreview(hit.document);
 *   }
 * }
 */
export interface DetectedLayout {
  /**
   * Detected kind: `'html'`, `'markdown'`, or `'none'`.
   */
  kind: DetectedLayoutKind;

  /**
   * Document body extracted from inside the fence, or the raw text when the
   * whole-message HTML fallback triggered.
   *
   * When `complete` is `false`, this may be an incomplete HTML snippet — your
   * preview should handle partial documents gracefully (show a skeleton or
   * loading indicator rather than rendering broken HTML).
   */
  document: string;

  /**
   * Whether the closing fence has arrived.
   *
   * - `true`: The document is complete; safe to validate and render.
   * - `false`: Still streaming — run `detectLayoutOutput` again on the next
   *   chunk to check for updates.
   *
   * @example
   * // Debounced streaming update
   * let timer: ReturnType<typeof setTimeout>;
   * function onChunk(chunk: string) {
   *   accumulated += chunk;
   *   clearTimeout(timer);
   *   timer = setTimeout(() => {
   *     const hit = detectLayoutOutput(accumulated);
   *     if (hit.complete) finalizePreview(hit.document);
   *     else updatePreview(hit.document);
   *   }, 100);
   * }
   */
  complete: boolean;

  /**
   * True when detection happened via the conservative whole-message HTML
   * fallback instead of the fence marker.
   *
   * The fallback triggers when the ENTIRE output is already a full HTML
   * document (starts with `<!doctype html>` or `<html>`) but has no fence.
   * Use this to distinguish fallback detections from normal fence-based
   * detections if needed — though in most cases you can treat them the same.
   */
  fallback?: boolean;
}

/**
 * An action item extracted from a guide-variant document.
 *
 * Action items are elements carrying `data-action-targets`, which lists the
 * host apps this item makes sense for. The host renders add-to-app buttons
 * from these attributes. Do not invent targets that don't fit the item.
 *
 * @example
 * // From parseLayoutDocument result
 * const items: LayoutActionItem[] = [
 *   { text: 'Schedule 30 minutes this week', targets: ['calendar', 'tasks'] },
 *   { text: 'Write down the three priorities', targets: ['notes'] },
 * ];
 */
export interface LayoutActionItem {
  /**
   * Human-readable action item text with HTML tags stripped.
   *
   * Extracted from between the opening and closing tags of the element
   * carrying `data-action-targets`.
   */
  text: string;

  /**
   * Host apps this item makes sense for.
   *
   * Allowed values are a strict subset of:
   * - `'tasks'` — Add to Tasks (Work ▸ Tasks or connected via MCP)
   * - `'calendar'` — Add to Calendar
   * - `'notes'` — Add to Notes
   *
   * Your host should show buttons for each target it supports.
   */
  targets: string[];
}

/**
 * Validated, normalized result of parsing a generated layout document.
 *
 * @example
 * const doc = parseLayoutDocument(hit.document, spec.outputPolicy);
 *
 * if (!doc.ok) {
 *   if (doc.reason === 'too-large') {
 *     showWarning('Document exceeded size limit');
 *     renderFallback(hit.document.slice(0, 2000));
 *   } else {
 *     showWarning('Empty layout document');
 *   }
 *   return;
 * }
 *
 * // Build CSP from embed inventory
 * const origins = [...new Set(doc.embeds.map(e => new URL(e.src).origin))];
 * const csp = `frame-src 'self' ${origins.join(' ')}`;
 *
 * // Render action items (guide variant)
 * for (const item of doc.actionItems) {
 *   renderActionButtons(item);
 * }
 */
export interface ParsedLayoutDocument {
  /**
   * Whether the document passed validation.
   *
   * False when:
   * - The document is empty (only whitespace)
   * - The document exceeds `maxDocumentBytes`
   */
  ok: boolean;

  /**
   * Set when `ok` is false.
   *
   * - `'empty'`: The document body contained only whitespace.
   * - `'too-large'`: The document exceeded the size cap.
   */
  reason?: 'too-large' | 'empty';

  /**
   * The original HTML string (unchanged).
   *
   * Safe to inject into an iframe's `srcdoc` attribute when `ok` is true.
   */
  html: string;

  /**
   * Byte size of the HTML string (UTF-8 encoded).
   *
   * Use this for logging, monitoring, or enforcing custom size limits beyond
   * the policy cap.
   */
  byteSize: number;

  /**
   * Number of `<img>` elements found in the document.
   *
   * Use this for audit logging or enforcing per-document image budgets.
   * The prompt instructs the model to use "at most 3 per section," but there
   * is no hard per-document limit enforced by the parser.
   */
  images: number;

  /**
   * Every `<iframe src>` URL found in the document.
   *
   * The host uses this inventory to build the iframe's `frame-src` CSP
   * directive. Never trust the model to declare its own frame policies —
   * always derive the CSP from this list.
   *
   * @example
   * // Build frame-src from embed inventory
   * const origins = [...new Set(doc.embeds.map(e => new URL(e.src).origin))];
   * const csp = `frame-src 'self' ${origins.join(' ')}`;
   */
  embeds: { src: string }[];

  /**
   * Action items carrying `data-action-targets` (guide variant contract).
   *
   * Only populated when the document was generated with the `'guide'`
   * variant. Other variants produce an empty array.
   *
   * @example
   * // Render add-to-app buttons for each action item
   * for (const item of doc.actionItems) {
   *   const btn = document.createElement('button');
   *   btn.textContent = `Add to ${item.targets.join(', ')}`;
   *   btn.addEventListener('click', () => addToApps(item));
   *   container.appendChild(btn);
   * }
   */
  actionItems: LayoutActionItem[];
}
