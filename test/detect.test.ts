import { describe, expect, it } from 'vitest';
import { detectLayoutOutput } from '../src/detect.js';

describe('detectLayoutOutput', () => {
  it('detects a complete html fence', () => {
    const r = detectLayoutOutput('Here you go:\n```layout:html\n<!DOCTYPE html><html></html>\n```\n');
    expect(r.kind).toBe('html');
    expect(r.complete).toBe(true);
    expect(r.document).toContain('<!DOCTYPE html>');
    expect(r.fallback).toBeUndefined();
  });

  it('detects a markdown fence', () => {
    const r = detectLayoutOutput('```layout:markdown\n# Title\n```');
    expect(r.kind).toBe('markdown');
    expect(r.complete).toBe(true);
    expect(r.document).toContain('# Title');
  });

  it('returns complete:false while the closing fence is still streaming', () => {
    const r = detectLayoutOutput('lead-in\n```layout:html\n<!DOCTYPE html><html>');
    expect(r.kind).toBe('html');
    expect(r.complete).toBe(false);
  });

  it('returns none for plain prose', () => {
    const r = detectLayoutOutput('Just a normal answer with `code` and text.');
    expect(r.kind).toBe('none');
    expect(r.complete).toBe(false);
  });

  it('falls back to whole-message html when the fence is missing', () => {
    const done = detectLayoutOutput('<!DOCTYPE html><html><body>hi</body></html>');
    expect(done.kind).toBe('html');
    expect(done.complete).toBe(true);
    expect(done.fallback).toBe(true);

    const streaming = detectLayoutOutput('<!DOCTYPE html><html><body>hi');
    expect(streaming.kind).toBe('html');
    expect(streaming.complete).toBe(false);
  });

  it('ignores html fragments that are not full documents', () => {
    const r = detectLayoutOutput('Use <b>bold</b> inline.');
    expect(r.kind).toBe('none');
  });
});
