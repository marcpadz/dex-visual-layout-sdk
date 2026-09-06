import { describe, expect, it } from 'vitest';
import { parseLayoutDocument } from '../src/parse.js';
import { DEFAULT_OUTPUT_POLICY } from '../src/types.js';

describe('parseLayoutDocument', () => {
  it('inventories images and iframes for the host CSP', () => {
    const r = parseLayoutDocument(
      '<body><img src="a.jpg"><img src="b.jpg"><iframe src="https://youtube.com/embed/x"></iframe></body>'
    );
    expect(r.ok).toBe(true);
    expect(r.images).toBe(2);
    expect(r.embeds).toEqual([{ src: 'https://youtube.com/embed/x' }]);
  });

  it('extracts guide action items with their targets', () => {
    const r = parseLayoutDocument(
      `<ul>
        <li data-action-targets="calendar tasks">Schedule 30 minutes this week</li>
        <li data-action-targets="notes">Set up the task list</li>
        <li>Not an action item</li>
      </ul>`
    );
    expect(r.actionItems).toEqual([
      { text: 'Schedule 30 minutes this week', targets: ['calendar', 'tasks'] },
      { text: 'Set up the task list', targets: ['notes'] },
    ]);
  });

  it('strips markup from action item text', () => {
    const r = parseLayoutDocument('<li data-action-targets="tasks"><b>Book</b> the <i>room</i> &amp; confirm</li>');
    expect(r.actionItems[0].text).toBe('Book the room & confirm');
  });

  it('rejects documents over the size cap', () => {
    const big = 'x'.repeat((DEFAULT_OUTPUT_POLICY.maxDocumentBytes ?? 2_000_000) + 1);
    const r = parseLayoutDocument(big);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('too-large');
  });

  it('respects a custom policy cap', () => {
    const r = parseLayoutDocument('x'.repeat(101), { allowRemoteImages: false, allowEmbeds: false, maxDocumentBytes: 100 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('too-large');
    expect(r.byteSize).toBe(101);
  });

  it('rejects empty documents', () => {
    const r = parseLayoutDocument('   ');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('empty');
  });
});
