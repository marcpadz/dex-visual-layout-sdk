# Coding Style Guide

Conventions and patterns for contributing to `dex-visual-layout-sdk`.

## Philosophy

This SDK is **harness-agnostic** and **zero-dependency**. Everything inside it is pure TypeScript — no React, no store, no network, no DOM. The goal is that any host (TypeScript, Rust, Python, etc.) can consume it without adaptation.

Guiding principles:
- **One source of truth**: `VisualLayoutSpec` drives everything. The same spec builds the prompt AND the CSP.
- **No per-variant renderers**: Adding a variant = adding a paragraph bank. No new code paths.
- **Deterministic over heuristic**: Detection uses exact fence matching, not heuristics.
- **Chunk-tolerant**: Everything works on partial input (streaming).

---

## File Structure

```
src/
  index.ts          # Re-exports (keep minimal)
  types.ts          # All public types and constants
  prompt.ts         # Prompt fragment builder + variant banks
  detect.ts         # Fence detection logic
  parse.ts          # Document validation + metadata extraction
test/
  *.test.ts         # Vitest tests matching src/ modules
docs/
  tutorials/        # Step-by-step guides
  API_REFERENCE.md  # Auto-generated API reference
  STYLEGUIDE.md     # This file
```

**Rules:**
- One public export per module, or a small related group in one file
- Private helpers stay in the same file as the public API that uses them
- Never add a new top-level file without a clear single responsibility

---

## Naming Conventions

### Files
- `kebab-case` for all source files: `detect.ts`, `parse.ts`
- `*.test.ts` suffix for test files

### Exports
- **Types and interfaces**: `PascalCase`
  - `VisualLayoutSpec`, `OutputPolicy`, `ParsedLayoutDocument`
- **Functions**: `camelCase`
  - `buildSystemPromptFragment`, `detectLayoutOutput`, `parseLayoutDocument`
- **Constants**: `UPPER_SNAKE_CASE` for exports, `camelCase` for internal
  - `HTML_VARIANTS`, `DEFAULT_SPEC`, `LAYOUT_FENCE_MARKER`
  - Internal: `VARIANT_BANKS`, `FENCE_RE`

### Variables
- **Public/external-facing**: descriptive nouns
  - `spec`, `hit`, `doc`, `fragment`
- **Internal helpers**: short, context-appropriate
  - `bank`, `lines`, `m` (for regex match results)
- **Loop variables**: `i`, `j`, `k` for indexes; `item`, `el` for iterables

### Private Helpers
Prefix with `_` only when they're truly internal implementation details not worth a descriptive name. Prefer descriptive names even for private functions.

```typescript
// Good: clear purpose
function policyText(spec: VisualLayoutSpec): string[] { ... }
function byteSize(s: string): number { ... }
function stripTags(html: string): string { ... }

// Bad: too generic
function foo(spec: VisualLayoutSpec): string[] { ... }
function getSize(s: string): number { ... }
```

---

## Type Patterns

### Use `readonly` for public constants
```typescript
// Good
export const HTML_VARIANTS: readonly HtmlLayoutVariant[] = [...];

// Bad
export const HTML_VARIANTS: HtmlLayoutVariant[] = [...];
```

### Prefer intersection types for extensions
```typescript
// Good: additive without modifying the base
interface ParsedLayoutDocument {
  ok: boolean;
  // ...
}

// When adding host-specific metadata, extend rather than mutate
interface ExtendedParseResult extends ParsedLayoutDocument {
  hostMetadata?: Record<string, unknown>;
}
```

### Use discriminated unions for mutually exclusive states
```typescript
// Good: explicit about which fields are present
interface ParsedLayoutDocument {
  ok: boolean;
  reason?: 'too-large' | 'empty';
  // ...
}
```

### Mark required fields clearly
```typescript
// Good: variant is optional with a sensible default, but callers know it's there
interface VisualLayoutSpec {
  enabled: boolean;
  preset: LayoutPreset;
  variant?: HtmlLayoutVariant;  // required when preset === 'html', defaults to 'workbook'
  outputPolicy: OutputPolicy;
}
```

---

## Architecture Patterns

### The Spec-First Pattern

Everything flows from `VisualLayoutSpec`. This is the single source of truth.

```typescript
// Host pattern: create spec once, reuse everywhere
const spec: VisualLayoutSpec = {
  ...DEFAULT_SPEC,
  enabled: true,
  variant: 'workbook',
  outputPolicy: { allowRemoteImages: true, allowEmbeds: false },
};

// Inject into prompt
const systemPrompt = `...${buildSystemPromptFragment(spec)}`;

// Validate output against same policy
const doc = parseLayoutDocument(hit.document, spec.outputPolicy);
```

### No Per-Variant Code Paths

Adding a variant should never require touching detection, parsing, or rendering logic.

```typescript
// Good: new variant = new entry in VARIANT_BANKS
const VARIANT_BANKS: Record<HtmlLayoutVariant, string> = {
  magazine: '...',
  // Add new variant here only
  myNewVariant: '...',
};

// Bad: if-else chain in detect.ts or parse.ts
if (variant === 'myNewVariant') {
  // ...
}
```

### Drift Guard

The output policy must be identical for prompt generation and CSP derivation.

```typescript
// Good: same policy object everywhere
const policy = { allowRemoteImages: true, allowEmbeds: true };
const fragment = buildSystemPromptFragment({ ...spec, outputPolicy: policy });
const doc = parseLayoutDocument(hit.document, policy);
const csp = buildCspFromDocument(doc, policy);

// Bad: mismatched policies
const promptPolicy = { allowEmbeds: true };
const cspPolicy = { allowEmbeds: false };  // drift!
```

### Chunk-Tolerant Detection

All detection must work on partial input.

```typescript
// Good: run on every chunk
function onChunk(chunk: string) {
  accumulated += chunk;
  const hit = detectLayoutOutput(accumulated);
  if (hit.complete) finalizePreview(hit.document);
  else updateStreamingPreview(hit.document);
}

// Bad: wait for complete before any feedback
function onChunk(chunk: string) {
  accumulated += chunk;
  if (isComplete(accumulated)) {
    render(accumulated);
  }
}
```

---

## Code Style

### Imports
```typescript
// Good: one import per line for named imports
import type { DetectedLayout, DetectedLayoutKind } from './types.js';
import { LAYOUT_FENCE_MARKER } from './types.js';

// Bad: mixed style
import { LAYOUT_FENCE_MARKER, type DetectedLayout } from './types.js';
```

### String Literals
```typescript
// Good: template literals for multiline, single quotes for short strings
const message = `Error: ${detail}`;
const fence = '```layout:html';

// Bad: double quotes unless required
const fence = "```layout:html";
```

### Error Handling
```typescript
// Good: early return for invalid states
if (!spec.enabled) return '';
if (html.trim().length === 0) {
  return { ok: false, reason: 'empty', ... };
}

// Bad: nested conditionals
if (spec.enabled) {
  if (html.trim().length > 0) {
    // ...
  }
}
```

### Regex Flags
```typescript
// Good: explicit flags on the same line as the pattern
const FENCE_RE = /```layout:(html|markdown)[^\n]*\n([\s\S]*?)(```|$)/;

// Good: separate variable for complex regexes
const iframeRe = /<iframe\b[^>]*\bsrc=["']([^"']+)["']/gi;
```

---

## Test Conventions

### Vitest Structure
```typescript
// test/detect.test.ts
import { describe, expect, it } from 'vitest';
import { detectLayoutOutput } from '../src/detect.js';

describe('detectLayoutOutput', () => {
  it('detects a complete html fence', () => {
    const r = detectLayoutOutput('```layout:html\n<html></html>\n```');
    expect(r.kind).toBe('html');
    expect(r.complete).toBe(true);
  });

  it('returns complete:false while streaming', () => {
    const r = detectLayoutOutput('```layout:html\n<html>');
    expect(r.complete).toBe(false);
  });
});
```

### Test Categories
1. **Happy path**: valid input produces expected output
2. **Edge cases**: empty strings, partial fences, oversized documents
3. **Streaming**: `complete: false` behavior
4. **Fallback**: whole-message HTML detection

---

## Documentation Standards

### JSDoc Requirements
Every public export must have JSDoc covering:
- What it does
- Parameters (with types and descriptions)
- Return value
- At least one usage example
- Any edge cases or caveats

```typescript
/**
 * Build the system-prompt fragment for the given spec.
 *
 * This is the single source of truth for what the model is told.
 * Returns '' when the capability is disabled.
 *
 * @param spec - The complete visual layout spec
 * @returns A non-empty string, or '' when disabled
 *
 * @example
 * const spec: VisualLayoutSpec = { enabled: true, ... };
 * const fragment = buildSystemPromptFragment(spec);
 */
export function buildSystemPromptFragment(spec: VisualLayoutSpec): string {
  // ...
}
```

### Comment Placement
```typescript
// Good: block comment above the declaration
/**
 * Determines whether a layout document is present in the model output.
 */
export function detectLayoutOutput(text: string): DetectedLayout { ... }

// Bad: inline comment at the end of the signature
export function detectLayoutOutput(text: string): DetectedLayout { /* ... */ }
```

---

## Anti-Patterns to Avoid

### ❌ Don't add framework dependencies
```typescript
// Bad
import React from 'react';
import { createPortal } from 'react-dom';

// Good: this SDK is framework-agnostic
```

### ❌ Don't add host-specific logic
```typescript
// Bad: hardcoding to a specific host
if (window.dexHost === 'dextop') {
  // ...
}

// Good: let the host handle its own concerns
```

### ❌ Don't use heuristics for detection
```typescript
// Bad: guessing based on content
if (text.includes('<html')) {
  return 'html';
}

// Good: match the exact wire contract
const m = text.match(FENCE_RE);
```

### ❌ Don't maintain separate policies
```typescript
// Bad: prompt and CSP use different policies
const promptPolicy = { allowEmbeds: true };
const cspPolicy = { allowEmbeds: false };

// Good: single source of truth
const policy = spec.outputPolicy;
```

### ❌ Don't parse HTML with regex for complex operations
```typescript
// Bad: trying to parse full HTML with regex
const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/);

// Good: use regex only for simple extraction (images, iframes, data attributes)
// For complex operations, let the host use DOMParser
```

---

## Git Conventions

### Commit Messages
```
feat: add interactive variant support
fix: handle unquoted iframe src attributes
docs: add streaming detection tutorial
chore: update types for v0.2.0
```

### Branch Naming
```
feature/new-variant
fix/detection-edge-case
docs/api-reference
```

---

## Review Checklist

Before submitting a PR, verify:

- [ ] All public exports have JSDoc comments
- [ ] Examples in JSDoc are accurate and runnable
- [ ] No framework dependencies added
- [ ] No host-specific logic added
- [ ] Tests cover happy path, edge cases, and streaming
- [ ] `npm test` and `npm run lint` pass
- [ ] `npm run build` produces clean output
- [ ] README updated if public surface changed
- [ ] `docs/API_REFERENCE.md` regenerated
