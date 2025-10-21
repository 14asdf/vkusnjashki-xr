import { WebGLRenderer } from 'three';

export interface IEngine {
  init(): void;
  addRandomObject(): void;
  getRenderer(): WebGLRenderer;
  dispose(): void;
}
