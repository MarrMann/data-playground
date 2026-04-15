import type { Visualizer } from '../types';

const MAX_DECODE_BYTES = 2 * 1024 * 1024; // 2 MB of text at a time

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

export const textVisualizer: Visualizer = (() => {
  let root: HTMLElement | null = null;

  return {
    id: 'text',
    name: 'Raw text',
    description: 'Best-effort UTF-8 with control glyphs',
    category: 'raw',
    mount(container, bytes) {
      root = document.createElement('div');
      root.className = 'viz-root';

      const scroll = document.createElement('div');
      scroll.className = 'viz-scroll';

      const slice = bytes.subarray(0, Math.min(bytes.length, MAX_DECODE_BYTES));
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const decoded = decoder.decode(slice);
      const pretty = visualizeControls(decoded);

      scroll.textContent = pretty;

      if (bytes.length > MAX_DECODE_BYTES) {
        const note = document.createElement('div');
        note.className = 'viz-overlay';
        const shown = (MAX_DECODE_BYTES / (1024 * 1024)).toFixed(1);
        const total = (bytes.length / (1024 * 1024)).toFixed(1);
        note.textContent = `Showing first ${shown} MB of ${total} MB`;
        root.appendChild(note);
      }

      root.appendChild(scroll);
      container.appendChild(root);
    },
    unmount() {
      root?.remove();
      root = null;
    },
  };
})();
