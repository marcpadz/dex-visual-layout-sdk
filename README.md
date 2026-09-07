# dex-visual-layout-sdk

A harness-agnostic **agent capability SDK**: give any agent harness a rich
visual-layout capability as pure, testable functions. Zero runtime
dependencies. No React, no store, no network, no DOM.

The capability: when enabled, the model generates **one complete,
self-contained HTML document** (or a markdown document) as its response, and
the host renders it inline as a beautiful, responsive, sandboxed card. The
same spec drives the prompt instructions **and** the preview's security
policy, so the model is never promised something the sandbox forbids.

## Install

```
npm install dex-visual-layout-sdk
```

## Public surface

| Export | Purpose |
|---|---|
| `VisualLayoutSpec` | `{ enabled, preset: 'html'\|'markdown', variant?, outputPolicy }` — the only persistent state; JSON-serializable. |
| `buildSystemPromptFragment(spec)` | The single source of truth for model instructions, including the output contract (one fenced block marked ```` ```layout:html ```` / ```` ```layout:markdown ````) and the policy-derived image/embed rules. Returns `''` when disabled. |
| `detectLayoutOutput(text)` | Deterministic, chunk-tolerant detection against the fence marker (no heuristics; conservative whole-message-HTML fallback). Works on completed messages and live stream buffers. |
| `parseLayoutDocument(html, policy?)` | Validation + normalization for the previewer: size cap, image/embed inventory, guide action items. |
| `DEFAULT_SPEC` / `DEFAULT_OUTPUT_POLICY` / `HTML_VARIANTS` / `LAYOUT_FENCE_MARKER` | Constants. |

## Usage (any harness)

```ts
import {
  buildSystemPromptFragment, detectLayoutOutput, parseLayoutDocument,
  DEFAULT_SPEC,
} from 'dex-visual-layout-sdk';

// 1. Inject the fragment into your system prompt for this turn
const spec = {
  ...DEFAULT_SPEC,
  enabled: true,
  preset: 'html',
  variant: 'feed',
  outputPolicy: { allowRemoteImages: true, allowEmbeds: false },
};
systemPrompt += '\n\n' + buildSystemPromptFragment(spec);

// 2. On the model's response (or each stream chunk):
const hit = detectLayoutOutput(assistantText);
if (hit.kind === 'html' && hit.complete) {
  // 3. Validate + derive the preview payload
  const doc = parseLayoutDocument(hit.document, spec.outputPolicy);
  // doc.ok, doc.images, doc.embeds → build your sandbox CSP
  // doc.actionItems → guide action items with host-app targets
}
```

## HTML variants (prompt-text only)

`magazine` · `portfolio` · `interactive` · `research` · `workbook` · `feed` · `guide`

All seven are paragraph banks inside `buildSystemPromptFragment` — one code
path, no per-variant renderer. The `markdown` preset has the `document` style.

### Attribute contracts (stable, host-consumable)

| Attribute | Variant | Meaning |
|---|---|---|
| `data-action-targets="tasks calendar notes"` | guide | Action items the host can offer to add to the user's task/calendar/notes apps (DexLab Work ▸ Tasks, or connected apps via MCP). Only targets that make sense for the item. |
| `data-conf="high\|moderate\|low"` | research | Source-quality confidence badges (grades the source, not the truth). |
| `data-guide-certificate` | guide | The completion-certificate section, locked until all steps are marked done. |

### Animated SVG diagrams

Workflow/process/system diagrams are inline SVG with pure SMIL/CSS animation
(marching dashes, traveling dots, pulsing nodes) — no JS, no libraries, so
they add no policy surface beyond the existing sandbox.

## Host adapter responsibilities (thin by design)

1. Persist the spec per session; offer a composer toggle.
2. Inject the fragment into the system prompt / system context block for the turn.
3. Run `detectLayoutOutput` on the response; render the document inline in a
   sandboxed frame (`sandbox="allow-scripts"`, **no** `allow-same-origin`) with
   a CSP derived from `spec.outputPolicy` and the `embeds` inventory.
4. Optionally offer "add to Tasks/Calendar/Notes" on `actionItems` via your
   integrations.
5. Provide an "expand" affordance to promote the document into your artifact /
   canvas view.

Rust hosts mirror `VisualLayoutSpec` as a small serde struct for request
validation — no prompt logic ever needs to leave this package.

## Mockups

See [`docs/mockups/dextop-visual-layout-mockup.html`](docs/mockups/dextop-visual-layout-mockup.html) —
a single, fully self-contained HTML file that demonstrates **all eight** doc
types the SDK can produce, switched live with a top tab bar. Every layout is
the same `html` preset (plus the `markdown` preset for Document); only the
paragraph bank injected into the system prompt differs.

| Doc | Variant / preset | Demonstrates |
|---|---|---|
| **Magazine** | `html · magazine` | Full-bleed hero, kicker, pull quote, two-column body, inline-SVG bar chart, click-to-load video cover |
| **Portfolio** | `html · portfolio` | Brand-tint header, 4-up stat row, mixed-aspect image grid, skill chips, testimonial card |
| **Interactive** | `html · interactive` | Pill tab bar, numbered steps, `<details>` accordions, hover-zoom image gallery |
| **Research** | `html · research` | Confidence badges, finding cards, hover-tooltip citations, evidence matrix, collapsed methodology, numbered refs |
| **Workbook** | `html · workbook` | TL;DR cards, three callout flavors, dotted-underline term tooltips, highlighted comparison table, click-to-check list, sources strip |
| **Feed** | `html · feed` | Click-to-load YouTube/Vimeo covers, working image carousel, social cards (X / TikTok / Instagram / Threads / Reddit / HN), animated verification workflow, source ledger |
| **Guide** | `html · guide` | Animated SVG loop diagram, tracked steps + progress meter, knowledge-check quizzes, **locked completion certificate** that unlocks when all steps are done, and `data-action-targets` routing to Tasks / Calendar / Notes |
| **Document** | `markdown` preset | Restrained typographic prose with h2 sections, table, blockquote, inline code, fenced code block |

The mockup uses the **real DexLab token values** from
`frontend/src/styles/tokens.css`, so the visual reads as production chrome. In
the actual host each generated document sits in a sandboxed iframe whose CSP
is derived from the same `outputPolicy` the prompt was built from — the mockup
omits the iframe boundary so all eight stay on one page.

Process and system diagrams (the Guide loop and the Feed verification
workflow) are **animated inline SVG** drawn by the model: marching dashes
(`stroke-dasharray` + `stroke-dashoffset` keyframes), a traveling dot
(SMIL `animateMotion`), and pulsing nodes (`opacity` keyframes). No JS, no
chart library, zero policy surface beyond the existing sandbox.

## Design rationale

See the originating plan in the Dextop repo:
`docs/plans/2026-09-06-visual-layout-sdk-plan.md`.

## Development

```
npm install
npm test        # vitest
npm run lint    # tsc --noEmit
npm run build   # tsc → dist/
```
