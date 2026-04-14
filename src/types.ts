export type VisualizerCategory = 'raw' | 'image' | 'audio' | '3d' | 'motion';

export interface Visualizer {
  /** Stable id used for selection and persistence. */
  id: string;
  /** Human-readable name shown in the sidebar. */
  name: string;
  /** Short one-line description shown under the name. */
  description: string;
  /** Grouping category. */
  category: VisualizerCategory;
  /**
   * Render the given bytes into the container. The visualizer owns the
   * container until `unmount` is called.
   */
  mount(container: HTMLElement, bytes: Uint8Array): void;
  /**
   * Tear down anything mount() created: event listeners, rAF loops, audio
   * contexts, WebGL renderers, etc.
   */
  unmount(): void;
}

export interface LoadedFile {
  name: string;
  size: number;
  bytes: Uint8Array;
}

/** Max file size in bytes. Exported so visualizers / UI can reference it. */
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
