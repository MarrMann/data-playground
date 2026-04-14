import type { Visualizer } from '../types';

const BYTES_PER_ROW = 16;
const ROW_HEIGHT = 19; // px; must match .hex-row line-height
const ROW_BUFFER = 8;  // extra rows rendered above/below viewport

/**
 * Hex dump with simple virtual scrolling so that 50 MB files (~3M rows)
 * don't blow up the DOM.
 */
class HexRenderer {
  private root!: HTMLElement;
  private viewport!: HTMLDivElement;
  private spacer!: HTMLDivElement;
  private rowHost!: HTMLDivElement;
  private bytes!: Uint8Array;
  private totalRows = 0;
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
    this.spacer.style.height = `${this.totalRows * ROW_HEIGHT}px`;
    this.spacer.style.position = 'relative';

    this.rowHost = document.createElement('div');
    this.rowHost.style.position = 'absolute';
    this.rowHost.style.top = '0';
    this.rowHost.style.left = '0';
    this.rowHost.style.right = '0';

    this.spacer.appendChild(this.rowHost);
    this.viewport.appendChild(this.spacer);
    this.root.appendChild(this.viewport);
    container.appendChild(this.root);

    this.viewport.addEventListener('scroll', this.onScroll, { passive: true });
    this.renderVisibleRows();
  }

  unmount(): void {
    this.viewport?.removeEventListener('scroll', this.onScroll);
    this.root?.remove();
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
    description: 'Address + hex + ASCII grid',
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
