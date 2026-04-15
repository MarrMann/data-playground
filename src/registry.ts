import type { Visualizer } from './types';
import { hexVisualizer } from './visualizers/hex';
import { textVisualizer } from './visualizers/text';
import { grayscaleVisualizer } from './visualizers/grayscale';
import { waveformVisualizer } from './visualizers/waveform';
import { pointCloudVisualizer } from './visualizers/pointCloud';
import { motionGraphicVisualizer } from './visualizers/motionGraphic';

/** Ordered list controls the sidebar order. */
export const visualizers: Visualizer[] = [
  hexVisualizer,
  textVisualizer,
  grayscaleVisualizer,
  waveformVisualizer,
  pointCloudVisualizer,
  motionGraphicVisualizer,
];

export function getVisualizer(id: string): Visualizer | undefined {
  return visualizers.find((v) => v.id === id);
}
