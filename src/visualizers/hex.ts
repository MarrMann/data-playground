import type { Visualizer } from '../types';

const BYTES_PER_ROW = 16;
const ROW_HEIGHT = 19; // px; must match .hex-row line-height
const ROW_BUFFER = 8;  // extra rows rendered above/below viewport

/**
 * Hex dump with virtual scrolling so that 50 MB files (~3M rows) don't blow up
 * the DOM. Auto-scrolls one row per frame; Space restarts from the top.
 */
class HexRenderer {
  private root!: HTMLElement;
  private viewport!: HTMLDivElement;
  private spacer!: HTMLDivElement;
  private rowHost!: HTMLDivElement;
  private bytes!: Uint8Array;
  private totalRows = 0;
  private rafId: number | null = null;
  private running = false;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private onScroll = () => this.renderVisibleRows();

  mount(container: HTMLElement, bytes: Uint8Array): void {
    this.bytes = bytes;
    this.totalRows = Math.ceil(bytes.length / BYTES_PER_ROW);

    this.root = document.createElement('div');
    this.root.className = 'viz-root';

    this.viewport = document.createElement('div');
    this.viewport.className = 'viz-scroll';
    this.viewport.style.position = 'relative';

    this.spacer = document.createElement('div');
    this.spacer.style.position = 'relative';

    this.rowHost = document.createElement('div');
    this.rowHost.style.position = 'absolute';
    this.rowHost.style.top = '0';
    this.rowHost.style.left = '0';
    this.rowHost.style.right = '0';

    this.spacer.appendChild(this.rowHost);
    this.viewport.appendChild(this.spacer);
    this.root.appendChild(this.viewport);

    const hint = document.createElement('div');
    hint.className = 'viz-overlay text-hint';
    hint.innerHTML = '<kbd>Space</kbd> to restart';
    this.root.appendChild(hint);

    container.appendChild(this.root);

    // Extend spacer so content can scroll fully off the top, leaving an empty viewport.
    const vpHeight = this.viewport.clientHeight;
    this.spacer.style.height = `${this.totalRows * ROW_HEIGHT + vpHeight}px`;

    this.viewport.addEventListener('scroll', this.onScroll, { passive: true });
    this.renderVisibleRows();
    this.startScroll();

    this.keyHandler = (e) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLElement) {
        if (t.isContentEditable) return;
        const tag = t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      }
      e.preventDefault();
      this.viewport.scrollTop = 0;
      this.renderVisibleRows();
      this.startScroll();
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  unmount(): void {
    this.running = false;
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    this.viewport?.removeEventListener('scroll', this.onScroll);
    this.root?.remove();
  }

  private startScroll(): void {
    this.running = true;
    if (this.rafId != null) cancelAnimationFrame(this.rafId);

    const step = () => {
      if (!this.running) return;
      this.viewport.scrollTop += ROW_HEIGHT;
      this.renderVisibleRows();
      const maxScroll = this.totalRows * ROW_HEIGHT;
      if (this.viewport.scrollTop >= maxScroll) {
        this.running = false;
        this.rafId = null;
        return;
      }
      this.rafId = requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }

  private renderVisibleRows(): void {
    const viewportHeight = this.viewport.clientHeight;
    const scrollTop = this.viewport.scrollTop;
    const firstRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - ROW_BUFFER);
    const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + ROW_BUFFER * 2;
    const lastRow = Math.min(this.totalRows, firstRow + visibleCount);

    const frag = document.createDocumentFragment();
    for (let row = firstRow; row < lastRow; row++) {
      frag.appendChild(this.renderRow(row));
    }
    this.rowHost.style.transform = `translateY(${firstRow * ROW_HEIGHT}px)`;
    this.rowHost.innerHTML = '';
    this.rowHost.appendChild(frag);
  }

  private renderRow(row: number): HTMLDivElement {
    const start = row * BYTES_PER_ROW;
    const end = Math.min(start + BYTES_PER_ROW, this.bytes.length);
    const div = document.createElement('div');
    div.className = 'hex-row';
    div.style.height = `${ROW_HEIGHT}px`;

    const addr = document.createElement('span');
    addr.className = 'hex-addr';
    addr.textContent = start.toString(16).padStart(8, '0');

    const hex = document.createElement('span');
    hex.className = 'hex-bytes';
    const hexParts: string[] = [];
    for (let i = start; i < end; i++) {
      hexParts.push(this.bytes[i]!.toString(16).padStart(2, '0'));
    }
    // Pad short final row so alignment stays stable.
    while (hexParts.length < BYTES_PER_ROW) hexParts.push('  ');
    hex.textContent = hexParts.join(' ');

    const ascii = document.createElement('span');
    ascii.className = 'hex-ascii';
    let asciiStr = '';
    for (let i = start; i < end; i++) {
      const b = this.bytes[i]!;
      asciiStr += b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.';
    }
    ascii.textContent = asciiStr;

    div.appendChild(addr);
    div.appendChild(hex);
    div.appendChild(ascii);
    return div;
  }
}

export const hexVisualizer: Visualizer = (() => {
  let renderer: HexRenderer | null = null;
  return {
    id: 'hex',
    name: 'Hex dump',
    description: 'Auto-scrolling hex + ASCII, Space to restart',
    category: 'raw',
    mount(container, bytes) {
      renderer = new HexRenderer();
      renderer.mount(container, bytes);
    },
    unmount() {
      renderer?.unmount();
      renderer = null;
    },
  };
})();
