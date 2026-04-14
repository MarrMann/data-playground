import type { Visualizer } from '../types';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const MAX_POINTS = 500_000; // keeps orbit smooth on mid-tier hardware

class PointCloudRenderer {
  private root!: HTMLElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private points!: THREE.Points;
  private frameId = 0;
  private resizeObserver!: ResizeObserver;

  mount(container: HTMLElement, bytes: Uint8Array): void {
    this.root = document.createElement('div');
    this.root.className = 'viz-root';
    this.root.style.background = '#000';
    container.appendChild(this.root);

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x000000);
    this.root.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 100);
    this.camera.position.set(1.6, 1.6, 1.6);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0.5, 0.5, 0.5);

    this.scene.add(this.buildAxes());
    this.points = this.buildPointCloud(bytes);
    this.scene.add(this.points);

    const overlay = document.createElement('div');
    overlay.className = 'viz-overlay';
    const triples = Math.floor(bytes.length / 3);
    const rendered = Math.min(triples, MAX_POINTS);
    const note = rendered < triples
      ? ` (sampled from ${triples.toLocaleString()})`
      : '';
    overlay.textContent = `${rendered.toLocaleString()} points${note} · drag to orbit, scroll to zoom`;
    this.root.appendChild(overlay);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
    this.animate();
  }

  unmount(): void {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    if (this.points) {
      (this.points.geometry as THREE.BufferGeometry).dispose();
      (this.points.material as THREE.Material).dispose();
    }
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.root?.remove();
  }

  private buildAxes(): THREE.LineSegments {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array([
      0, 0, 0,   1, 0, 0,
      0, 0, 0,   0, 1, 0,
      0, 0, 0,   0, 0, 1,
    ]);
    const colors = new Float32Array([
      1, 0.4, 0.4,   1, 0.4, 0.4,
      0.4, 1, 0.4,   0.4, 1, 0.4,
      0.4, 0.6, 1,   0.4, 0.6, 1,
    ]);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5 });
    return new THREE.LineSegments(geom, mat);
  }

  private buildPointCloud(bytes: Uint8Array): THREE.Points {
    const totalTriples = Math.floor(bytes.length / 3);
    const count = Math.min(totalTriples, MAX_POINTS);
    // Stride samples evenly so the point cloud represents the whole file,
    // not just its first N bytes.
    const stride = totalTriples <= MAX_POINTS ? 1 : Math.floor(totalTriples / MAX_POINTS);

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const src = (i * stride) * 3;
      const x = bytes[src]! / 255;
      const y = bytes[src + 1]! / 255;
      const z = bytes[src + 2]! / 255;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      // Color by position for legibility.
      colors[i * 3] = x;
      colors[i * 3 + 1] = y;
      colors[i * 3 + 2] = z;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: 0.005,
      vertexColors: true,
      sizeAttenuation: true,
    });
    return new THREE.Points(geom, material);
  }

  private handleResize(): void {
    const width = Math.max(1, this.root.clientWidth);
    const height = Math.max(1, this.root.clientHeight);
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private animate = (): void => {
    this.frameId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}

export const pointCloudVisualizer: Visualizer = (() => {
  let renderer: PointCloudRenderer | null = null;
  return {
    id: 'pointCloud',
    name: '3D point cloud',
    description: 'Byte triples → XYZ points, orbit to explore',
    category: '3d',
    mount(container, bytes) {
      renderer = new PointCloudRenderer();
      renderer.mount(container, bytes);
    },
    unmount() {
      renderer?.unmount();
      renderer = null;
    },
  };
})();
