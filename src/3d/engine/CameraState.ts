import {
  PerspectiveCamera,
  Euler,
  Quaternion,
  Vector3,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CAMERA_FOV, CAMERA_ZOOM, CAMERA_ASPECT, CAMERA_TARGET } from '@/3d/constants';

export class CameraState {
  position = new Vector3();
  rotation = new Euler();
  quaternion = new Quaternion();
  fov = CAMERA_FOV;
  zoom = CAMERA_ZOOM;
  aspect = CAMERA_ASPECT;
  controlsTarget = CAMERA_TARGET;

  save(camera: PerspectiveCamera, controls: OrbitControls): void {
    this.position.copy(camera.position);
    this.rotation.copy(camera.rotation);
    this.quaternion.copy(camera.quaternion);
    this.fov = camera.fov;
    this.zoom = camera.zoom;
    this.aspect = camera.aspect;
    this.controlsTarget.copy(controls.target);
  }

  restore(camera: PerspectiveCamera, controls: OrbitControls): void {
    camera.position.copy(this.position);
    camera.rotation.copy(this.rotation);
    camera.quaternion.copy(this.quaternion);
    camera.fov = this.fov;
    camera.zoom = this.zoom;
    camera.aspect = this.aspect;
    controls.target.copy(this.controlsTarget);
  }
}
