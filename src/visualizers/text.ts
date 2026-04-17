import type { Visualizer } from '../types';

const MAX_DECODE_BYTES = 2 * 1024 * 1024; // 2 MB of text at a time
const LINE_STEP_MS = 60; // how long each line sits on screen before the next one pushes up

/** Map C0 / C1 control bytes to printable replacement glyphs. */
function visualizeControls(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (ch === '\n' || ch === '\t') {
      out += ch;
    } else if (code < 0x20 || code === 0x7f) {
      // C0 controls: use Unicode "Control Pictures" block (U+2400..U+2421)
      out += code === 0x7f ? '\u2421' : String.fromCodePoint(0x2400 + code);
    } else {
      out += ch;
    }
  }
  return out;
}

/** Resolve an element's line-height to pixels. Falls back to 1.4 × font-size. */
function getLineHeightPx(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  const lh = cs.lineHeight;
  if (lh.endsWith('px')) {
    const px = parseFloat(lh);
    if (!Number.isNaN(px) && px > 0) return px;
  }
  const fs = parseFloat(cs.fontSize) || 14;
  return fs * 1.4;
}

export const textVisualizer: Visualizer = (() => {
  let root: HTMLElement | null = null;
  let intervalId: number | null = null;
  let keyHandler: ((e: KeyboardEvent) => void) | null = null;

  return {
    id: 'text',
    name: 'Raw text',
    description: 'Auto-scrolling UTF-8, Space to restart',
    category: 'raw',
    mount(container, bytes) {
      root = document.createElement('div');
      root.className = 'viz-root text-viz';

      const scroller = document.createElement('div');
      scroller.className = 'text-scroller';
      const inner = document.createElement('div');
      inner.className = 'text-scroller-inner';

      const slice = bytes.subarray(0, Math.min(bytes.length, MAX_DECODE_BYTES));
      const decoder = new TextDecoder('utf-8', { fatal: false });
      inner.textContent = visualizeControls(decoder.decode(slice));

      scroller.appendChild(inner);
      root.appendChild(scroller);

      if (bytes.length > MAX_DECODE_BYTES) {
        const note = document.createElement('div');
        note.className = 'viz-overlay';
        const shown = (MAX_DECODE_BYTES / (1024 * 1024)).toFixed(1);
        const total = (bytes.length / (1024 * 1024)).toFixed(1);
        note.textContent = `Showing first ${shown} MB of ${total} MB`;
        root.appendChild(note);
      }

      const hint = document.createElement('div');
      hint.className = 'viz-overlay text-hint';
      hint.innerHTML = '<kbd>Space</kbd> to restart';
      root.appendChild(hint);

      container.appendChild(root);

      // Now in the DOM — safe to measure.
      const lineHeight = getLineHeightPx(inner);
      let offset = 0;

      const step = () => {
        offset += lineHeight;
        inner.style.transform = `translateY(${-offset}px)`;
        // Stop when the bottom of the content has risen past the top of the viewport.
        if (offset >= inner.offsetHeight) {
          if (intervalId != null) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      };

      const start = () => {
        offset = 0;
        inner.style.transform = 'translateY(0)';
        if (intervalId != null) clearInterval(intervalId);
        intervalId = window.setInterval(step, LINE_STEP_MS);
      };

      start();

      keyHandler = (e) => {
        if (e.code !== 'Space' && e.key !== ' ') return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const t = e.target;
        if (t instanceof HTMLElement) {
          if (t.isContentEditable) return;
          const tag = t.tagName;
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        }
        e.preventDefault();
        start();
      };
      window.addEventListener('keydown', keyHandler);
    },
    unmount() {
      if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      if (keyHandler) {
        window.removeEventListener('keydown', keyHandler);
        keyHandler = null;
      }
      root?.remove();
      root = null;
    },
  };
})();
