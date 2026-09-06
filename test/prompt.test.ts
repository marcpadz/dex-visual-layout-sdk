import { describe, expect, it } from 'vitest';
import { buildSystemPromptFragment } from '../src/prompt.js';
import { DEFAULT_SPEC, HTML_VARIANTS, type VisualLayoutSpec } from '../src/types.js';

const spec = (over: Partial<VisualLayoutSpec>): VisualLayoutSpec => ({
  ...DEFAULT_SPEC,
  ...over,
  outputPolicy: { ...DEFAULT_SPEC.outputPolicy, ...over.outputPolicy },
});

describe('buildSystemPromptFragment', () => {
  it('returns an empty string when disabled', () => {
    expect(buildSystemPromptFragment(spec({ enabled: false }))).toBe('');
  });

  it('emits the layout:html fence contract for the html preset', () => {
    const frag = buildSystemPromptFragment(spec({ enabled: true, preset: 'html', variant: 'workbook' }));
    expect(frag).toContain('```layout:html');
    expect(frag).toContain('<!DOCTYPE html>');
    expect(frag).toContain('workbook');
  });

  it('emits the layout:markdown contract for the markdown preset', () => {
    const frag = buildSystemPromptFragment(spec({ enabled: true, preset: 'markdown' }));
    expect(frag).toContain('```layout:markdown');
    expect(frag).not.toContain('```layout:html');
  });

  it('couples images policy to the prompt (the drift guard)', () => {
    const allowed = buildSystemPromptFragment(spec({ enabled: true, outputPolicy: { allowRemoteImages: true, allowEmbeds: false } }));
    const denied = buildSystemPromptFragment(spec({ enabled: true, outputPolicy: { allowRemoteImages: false, allowEmbeds: false } }));
    expect(allowed).toMatch(/remote <img> URLs are allowed/);
    expect(denied).toMatch(/remote images are NOT allowed/);
  });

  it('couples embeds policy to the prompt (the drift guard)', () => {
    const allowed = buildSystemPromptFragment(spec({ enabled: true, outputPolicy: { allowRemoteImages: true, allowEmbeds: true } }));
    const denied = buildSystemPromptFragment(spec({ enabled: true, outputPolicy: { allowRemoteImages: true, allowEmbeds: false } }));
    expect(allowed).toMatch(/click-to-load cover cards/);
    expect(denied).toMatch(/iframes and third-party embeds are NOT allowed/);
  });

  it('has a distinct bank for every html variant', () => {
    const frags = HTML_VARIANTS.map((v) =>
      buildSystemPromptFragment(spec({ enabled: true, preset: 'html', variant: v }))
    );
    expect(new Set(frags).size).toBe(HTML_VARIANTS.length);
  });

  it('guide variant mandates the action-item attribute contract', () => {
    const frag = buildSystemPromptFragment(spec({ enabled: true, preset: 'html', variant: 'guide' }));
    expect(frag).toContain('data-action-targets');
    expect(frag).toContain('data-guide-certificate');
    expect(frag).toMatch(/tasks, calendar, notes/);
  });

  it('feed variant frames resources-not-conclusions', () => {
    const frag = buildSystemPromptFragment(spec({ enabled: true, preset: 'html', variant: 'feed' }));
    expect(frag).toMatch(/resources the user verifies/i);
    expect(frag).toContain('Hacker News');
    expect(frag).toContain('Reddit');
  });
});
