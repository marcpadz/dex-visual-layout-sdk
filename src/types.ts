// dex-visual-layout-sdk — types and constants

/** Prompt-text style variants of the single `html` preset. Each is a paragraph
 *  bank inside buildSystemPromptFragment; adding a variant never changes code
 *  paths, renderer behavior, or the wire contract. */
export type HtmlLayoutVariant =
  | 'magazine'
  | 'portfolio'
  | 'interactive'
  | 'research'
  | 'workbook'
  | 'feed'
  | 'guide';

export type LayoutPreset = 'html' | 'markdown';

/** What the generated document may load. The SAME spec drives both the prompt
 *  instructions and the host's iframe sandbox/CSP — prompt and preview can
 *  never drift apart. */
export interface OutputPolicy {
  /** Remote <img> sources in the generated document. */
  allowRemoteImages: boolean;
  /** Click-to-load video/social embeds (YouTube, Vimeo, …). */
  allowEmbeds: boolean;
  /** Hard cap on the generated document size in bytes (default 2 MB). */
  maxDocumentBytes?: number;
}

/** The single persistent state of the capability. JSON-serializable; hosts may
 *  mirror it as a small struct (e.g. a ~30-line serde struct in Rust). */
export interface VisualLayoutSpec {
  enabled: boolean;
  preset: LayoutPreset;
  /** Required when preset is 'html'. */
  variant?: HtmlLayoutVariant;
  outputPolicy: OutputPolicy;
}

export const HTML_VARIANTS: readonly HtmlLayoutVariant[] = [
  'magazine',
  'portfolio',
  'interactive',
  'research',
  'workbook',
  'feed',
  'guide',
];

export const DEFAULT_OUTPUT_POLICY: OutputPolicy = {
  allowRemoteImages: true,
  allowEmbeds: false,
  maxDocumentBytes: 2_000_000,
};

export const DEFAULT_SPEC: VisualLayoutSpec = {
  enabled: false,
  preset: 'html',
  variant: 'workbook',
  outputPolicy: { ...DEFAULT_OUTPUT_POLICY },
};

/** Wire contract: the model emits exactly one fenced code block whose info
 *  string starts with LAYOUT_FENCE_MARKER. Detection is deterministic against
 *  this marker — no heuristics. */
export const LAYOUT_FENCE_MARKER = 'layout:';

export type DetectedLayoutKind = 'html' | 'markdown' | 'none';

export interface DetectedLayout {
  kind: DetectedLayoutKind;
  /** Document body (inside the fence), or the raw text for the fallback. */
  document: string;
  /** False while the model is still streaming the closing fence. */
  complete: boolean;
  /** True when detected via the whole-message HTML fallback instead of the fence marker. */
  fallback?: boolean;
}

export interface LayoutActionItem {
  /** Human-readable action item text (tags stripped). */
  text: string;
  /** Host apps this item makes sense for, e.g. ['tasks','calendar','notes']. */
  targets: string[];
}

export interface ParsedLayoutDocument {
  ok: boolean;
  /** Set when ok is false: 'too-large' | 'empty'. */
  reason?: 'too-large' | 'empty';
  html: string;
  byteSize: number;
  /** Number of <img> elements. */
  images: number;
  /** Every <iframe src> found — the host uses this to build its sandbox CSP. */
  embeds: { src: string }[];
  /** Action items carrying data-action-targets (guide variant contract). */
  actionItems: LayoutActionItem[];
}
