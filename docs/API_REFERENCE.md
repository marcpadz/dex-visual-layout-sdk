# API Reference

Auto-generated from TSDoc comments in `src/`. For a more narrative walkthrough, see [docs/tutorials/](./tutorials/).

## Table of Contents

- [Types](#types)
  - [HtmlLayoutVariant](#htmlayoutvariant)
  - [LayoutPreset](#layoutpreset)
  - [OutputPolicy](#outputpolicy)
  - [VisualLayoutSpec](#visuallayoutspec)
  - [DetectedLayout](#detectedlayout)
  - [DetectedLayoutKind](#detectedlayoutkind)
  - [LayoutActionItem](#layoutactionitem)
  - [ParsedLayoutDocument](#parsedlayoutdocument)
- [Constants](#constants)
  - [HTML_VARIANTS](#htmlvariants)
  - [DEFAULT_OUTPUT_POLICY](#default_output_policy)
  - [DEFAULT_SPEC](#default_spec)
  - [LAYOUT_FENCE_MARKER](#layout_fence_marker)
- [Functions](#functions)
  - [buildSystemPromptFragment](#buildsystempromptfragment)
  - [detectLayoutOutput](#detectlayoutoutput)
  - [parseLayoutDocument](#parselayoutdocument)

---

## Types

### HtmlLayoutVariant

```typescript
type HtmlLayoutVariant =
  | 'magazine'
  | 'portfolio'
  | 'interactive'
  | 'research'
  | 'workbook'
  | 'feed'
  | 'guide';
```

Prompt-text style variants of the single `html` preset. Each is a paragraph bank inside `buildSystemPromptFragment`; adding a variant never changes code paths, renderer behavior, or the wire contract.

| Variant | When to use |
|---|---|
| `'magazine'` | Editorial feature pieces with hero images, two-column body, inline SVG charts |
| `'portfolio'` | Case studies with stat cards, mixed-aspect image grids, skill chips, testimonials |
| `'interactive'` | Explorable guides with tab bars, numbered steps, accordions, hover-zoom galleries |
| `'research'` | Evidence reviews with confidence badges, citation tooltips, evidence matrix tables |
| `'workbook'` | Day-to-day decision docs with TL;DR cards, callouts, comparison tables, checklists |
| `'feed'` | Multi-platform source boards with click-to-load video covers, image carousels, social cards |
| `'guide'` | Instructional modules with animated SVG diagrams, step tracking, quizzes, completion certificates |

---

### LayoutPreset

```typescript
type LayoutPreset = 'html' | 'markdown';
```

Top-level preset selector.

- `'html'` (default): complete, self-contained HTML document
- `'markdown'`: clean typographic prose wrapped in a markdown fence

---

### OutputPolicy

```typescript
interface OutputPolicy {
  allowRemoteImages: boolean;
  allowEmbeds: boolean;
  maxDocumentBytes?: number;
}
```

Controls what resources the generated document may load. The SAME spec drives both the prompt instructions and the host's iframe sandbox/CSP — this is the "drift guard": the model is never promised something the preview forbids.

| Property | Type | Default | Description |
|---|---|---|---|
| `allowRemoteImages` | `boolean` | `true` | Whether the model may include real remote `<img>` URLs. When `false`, the prompt instructs the model to use inline `<svg>` illustrations instead. |
| `allowEmbeds` | `boolean` | `false` | Whether the model may include click-to-load video/social embeds. When `true`, the model may generate static cover cards that swap in a real `<iframe>` on user click. Never autoplay. |
| `maxDocumentBytes` | `number` | `2_000_000` | Hard cap on the generated document size in bytes (UTF-8 encoded). Documents exceeding this limit cause `parseLayoutDocument` to return `{ ok: false, reason: 'too-large' }`. |

---

### VisualLayoutSpec

```typescript
interface VisualLayoutSpec {
  enabled: boolean;
  preset: LayoutPreset;
  variant?: HtmlLayoutVariant;
  outputPolicy: OutputPolicy;
}
```

The single persistent state of the visual layout capability. JSON-serializable — hosts may mirror this as a small struct (e.g. a ~30-line serde struct in Rust). Create it once at session start and pass it through every SDK call.

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `enabled` | `boolean` | Yes | — | Whether the visual layout capability is active. When `false`, `buildSystemPromptFragment` returns `''`. |
| `preset` | `LayoutPreset` | Yes | — | Document format: `'html'` or `'markdown'`. |
| `variant` | `HtmlLayoutVariant` | When `preset === 'html'` | `'workbook'` | Layout style variant. Defaults to `'workbook'` when omitted. |
| `outputPolicy` | `OutputPolicy` | Yes | — | Resource policy governing what the generated document may load. |

---

### DetectedLayout

```typescript
interface DetectedLayout {
  kind: DetectedLayoutKind;
  document: string;
  complete: boolean;
  fallback?: boolean;
}
```

Result of detecting a layout document in model output.

| Property | Type | Description |
|---|---|---|
| `kind` | `DetectedLayoutKind` | `'html'`, `'markdown'`, or `'none'` |
| `document` | `string` | Document body extracted from inside the fence, or the raw text when the whole-message HTML fallback triggered. When `complete` is `false`, this may be an incomplete HTML snippet. |
| `complete` | `boolean` | Whether the closing fence has arrived. `true` means the document is complete and safe to validate and render. |
| `fallback?` | `boolean` | True when detection happened via the conservative whole-message HTML fallback instead of the fence marker. |

---

### DetectedLayoutKind

```typescript
type DetectedLayoutKind = 'html' | 'markdown' | 'none';
```

Kind of layout detected in model output.

---

### LayoutActionItem

```typescript
interface LayoutActionItem {
  text: string;
  targets: string[];
}
```

An action item extracted from a guide-variant document.

| Property | Type | Description |
|---|---|---|
| `text` | `string` | Human-readable action item text with HTML tags stripped. |
| `targets` | `string[]` | Host apps this item makes sense for. Allowed values: `'tasks'`, `'calendar'`, `'notes'`. |

---

### ParsedLayoutDocument

```typescript
interface ParsedLayoutDocument {
  ok: boolean;
  reason?: 'too-large' | 'empty';
  html: string;
  byteSize: number;
  images: number;
  embeds: { src: string }[];
  actionItems: LayoutActionItem[];
}
```

Validated, normalized result of parsing a generated layout document.

| Property | Type | Description |
|---|---|---|
| `ok` | `boolean` | Whether the document passed validation. False when the document is empty or exceeds the size cap. |
| `reason?` | `'too-large' \| 'empty'` | Set when `ok` is false. `'empty'` = only whitespace; `'too-large'` = exceeded `maxDocumentBytes`. |
| `html` | `string` | The original HTML string (unchanged). Safe to inject into an iframe's `srcdoc` when `ok` is true. |
| `byteSize` | `number` | Byte size of the HTML string (UTF-8 encoded). |
| `images` | `number` | Number of `<img>` elements found in the document. |
| `embeds` | `{ src: string }[]` | Every `<iframe src>` URL found. Use this inventory to build the iframe's `frame-src` CSP. |
| `actionItems` | `LayoutActionItem[]` | Action items carrying `data-action-targets`. Only populated for the `'guide'` variant. |

---

## Constants

### HTML_VARIANTS

```typescript
const HTML_VARIANTS: readonly HtmlLayoutVariant[] = [
  'magazine',
  'portfolio',
  'interactive',
  'research',
  'workbook',
  'feed',
  'guide',
];
```

Stable, sorted list of all supported HTML variants. Use this for populating UI dropdowns, iterating for tests, or validating user input.

---

### DEFAULT_OUTPUT_POLICY

```typescript
const DEFAULT_OUTPUT_POLICY: OutputPolicy = {
  allowRemoteImages: true,
  allowEmbeds: false,
  maxDocumentBytes: 2_000_000,
};
```

Default output policy — remote images allowed, no embeds, 2 MB size cap. Spread this into your spec to avoid repeating the boilerplate.

---

### DEFAULT_SPEC

```typescript
const DEFAULT_SPEC: VisualLayoutSpec = {
  enabled: false,
  preset: 'html',
  variant: 'workbook',
  outputPolicy: { ...DEFAULT_OUTPUT_POLICY },
};
```

Default spec — disabled, html preset, workbook variant, default policy. Use as the base and spread overrides.

---

### LAYOUT_FENCE_MARKER

```typescript
const LAYOUT_FENCE_MARKER = 'layout:';
```

Wire contract marker: the model must emit exactly one fenced code block whose info string starts with this value. Detection is deterministic against this marker — no heuristics.

Both ```` ```layout:html ```` and ```` ```layout:markdown ```` are valid. Variations like ```` ``` layout:html ```` (space after fence) or ```` ```Layout:HTML ```` (wrong case) will **not** match.

---

## Functions

### buildSystemPromptFragment

```typescript
function buildSystemPromptFragment(spec: VisualLayoutSpec): string;
```

Build the system-prompt fragment for the given spec. This is the **single source of truth** for what the model is told about the visual layout capability. Hosts inject the returned string into their system prompt or system context block before each turn.

When `spec.enabled` is `false`, returns an empty string — safe to always append without conditional logic.

**Parameters:**
- `spec` (`VisualLayoutSpec`): The complete visual layout spec controlling style and policy

**Returns:** `string` — A non-empty string describing the layout style and output contract, or `''` when the capability is disabled

**Example:**
```typescript
const spec: VisualLayoutSpec = {
  enabled: true,
  preset: 'html',
  variant: 'workbook',
  outputPolicy: { allowRemoteImages: true, allowEmbeds: false },
};
const fragment = buildSystemPromptFragment(spec);
// → '## Visual Layout active — preset: html · style: workbook\n\n...'
```

---

### detectLayoutOutput

```typescript
function detectLayoutOutput(text: string): DetectedLayout;
```

Deterministic detection against the wire contract. The model must emit exactly one fenced code block whose info string starts with ```${LAYOUT_FENCE_MARKER}```. This function searches for that fence and extracts the document body.

Chunk-tolerant: safe to run on a live stream buffer. Returns `complete: false` while the closing fence hasn't arrived yet, allowing your UI to show a streaming preview.

Conservative fallback: if the model drops the fence entirely but the ENTIRE output is already a full HTML document (starts with `<!doctype html>` or `<html>`), treat it as an HTML layout. The `fallback` flag is set to `true`.

**Parameters:**
- `text` (`string`): The model's response text (full message or live stream buffer)

**Returns:** `DetectedLayout` — A `DetectedLayout` describing what was found

**Example:**
```typescript
// Normal fence-based detection
const hit = detectLayoutOutput('Here you go:\n```layout:html\n<!DOCTYPE html>...</html>\n```');
// → { kind: 'html', document: '<!DOCTYPE html>...', complete: true }

// Streaming — closing fence hasn't arrived yet
const hit = detectLayoutOutput('lead-in\n```layout:html\n<!DOCTYPE html><html>');
// → { kind: 'html', document: '<!DOCTYPE html><html>', complete: false }

// Plain text — no layout
const hit = detectLayoutOutput('Just a normal answer with `code` and text.');
// → { kind: 'none', document: '', complete: false }
```

---

### parseLayoutDocument

```typescript
function parseLayoutDocument(
  html: string,
  policy?: OutputPolicy
): ParsedLayoutDocument;
```

Validate and normalize a generated layout document for the host's previewer. Performs three checks:

1. **Size validation**: rejects documents exceeding `policy.maxDocumentBytes`
2. **Resource inventory**: counts `<img>` elements and extracts all `<iframe src>` URLs
3. **Action item extraction**: finds elements with `data-action-targets` (guide variant contract)

The embed inventory is the key output — host applications use it to build the iframe's `frame-src` CSP directive. Never trust the model to declare its own frame policies; always derive the CSP from `doc.embeds`.

**Parameters:**
- `html` (`string`): The raw HTML document body (from `DetectedLayout.document`)
- `policy` (`OutputPolicy`, optional): Output policy for size validation; defaults to `DEFAULT_OUTPUT_POLICY`

**Returns:** `ParsedLayoutDocument` — Validation results and resource inventory

**Example:**
```typescript
const doc = parseLayoutDocument(hit.document, spec.outputPolicy);

if (!doc.ok) {
  if (doc.reason === 'too-large') {
    showWarning('Document exceeded size limit');
    renderFallback(hit.document.slice(0, 2000));
  }
  return;
}

// Build CSP from embed inventory
const origins = [...new Set(doc.embeds.map(e => new URL(e.src).origin))];
const csp = `frame-src 'self' ${origins.join(' ')}`;
```
