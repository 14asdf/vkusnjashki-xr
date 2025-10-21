import {
  WebGLRenderer,
  PerspectiveCamera,
  Scene,
  Box3,
  Vector3,
  Euler,
  Quaternion,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Color,
  Group,
  Object3D,
  Raycaster,
  XRTargetRaySpace,
  BufferGeometry,
  Line,
  SphereGeometry,
  MeshBasicMaterial,
  DoubleSide,
  HemisphereLight,
  DirectionalLight,
  Intersection,
  ShadowMaterial,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  ROOM_WIDTH,
  ROOM_HEIGHT,
  ROOM_DEPTH,
  OBJECTS_DISTANCE_FROM_CAMERA,
  MODELS,
} from '@/3d/constants';
import {
  TXRControllerEvent,
  TGamepadButton,
  TEngineCallbacks,
} from '@/3d/engine/types';
import { IEngine } from '@/3d/engine/interfaces';

export class Engine implements IEngine {
  private camera!: PerspectiveCamera;
  private scene!: Scene;
  private renderer!: WebGLRenderer;
  private controller1!: XRTargetRaySpace;
  private controller2!: XRTargetRaySpace;
  private raycaster!: Raycaster;
  private controls!: OrbitControls;
  private group!: Group;
  private loadedModels: Group[] = [];

  private savedCameraPosition = new Vector3();
  private savedCameraRotation = new Euler();
  private savedCameraQuaternion = new Quaternion();
  private savedControlsTarget = new Vector3();
  private savedCameraFov = 50;
  private savedCameraZoom = 1;
  private savedCameraAspect = 1;

  private intersected: Object3D[] = [];
  private loader = new GLTFLoader();
  private lastHoveredObjectName: string | null = null;

  private fallingObjects: Map<
    Object3D,
    { velocity: number; isFalling: boolean }
  > = new Map();
  private gravity = -0.001;
  private floorY = -0.5;
  private roomBounds = {
    minX: -ROOM_WIDTH / 2,
    maxX: ROOM_WIDTH / 2,
    minY: -0.5,
    maxY: ROOM_HEIGHT - 0.5,
    minZ: -ROOM_DEPTH / 2,
    maxZ: ROOM_DEPTH / 2,
  };

  private lastButtonStates: Map<number, boolean[]> = new Map();

  constructor(
    private container: HTMLDivElement,
    private callbacks: TEngineCallbacks
  ) {}

  public init(): void {
    this.createScene();
    this.createCamera();
    this.createControls();
    this.createFloorAndWalls();
    this.createLights();
    this.createGroup();
    this.loadModels();
    this.createRenderer();
    this.setupControllers();
    this.startRendering();
  }

  public addRandomObject(): void {
    if (this.loadedModels.length === 0) {
      return;
    }

    const randomIndex = Math.floor(Math.random() * this.loadedModels.length);
    const modelTemplate = this.loadedModels[randomIndex];

    const newModel = modelTemplate.clone(true);

    newModel.traverse((child) => {
      if (child instanceof Mesh) {
        if (child.geometry) {
          child.geometry = child.geometry.clone();
        }

        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material = child.material.map((mat) => {
              const clonedMat = mat.clone();
              if (clonedMat instanceof MeshStandardMaterial) {
                clonedMat.emissive.setHex(0x000000);
              }
              return clonedMat;
            });
          } else {
            child.material = child.material.clone();
            if (child.material instanceof MeshStandardMaterial) {
              child.material.emissive.setHex(0x000000);
            }
          }
        }

        child.castShadow = true;
      }
    });

    const direction = new Vector3();
    this.camera.getWorldDirection(direction);

    const distance = 2 + Math.random();

    const basePosition = this.camera.position
      .clone()
      .add(direction.multiplyScalar(distance));

    const offsetX = (Math.random() - 0.5) * 1;
    const offsetY = (Math.random() - 0.5) * 0.5;
    const offsetZ = (Math.random() - 0.5) * 1;

    const x = basePosition.x + offsetX;
    const y = basePosition.y + offsetY;
    const z = basePosition.z + offsetZ;

    const constrainedX = Math.max(
      this.roomBounds.minX,
      Math.min(this.roomBounds.maxX, x)
    );
    const constrainedY = Math.max(
      this.roomBounds.minY,
      Math.min(this.roomBounds.maxY, y)
    );
    const constrainedZ = Math.max(
      this.roomBounds.minZ,
      Math.min(this.roomBounds.maxZ, z)
    );

    newModel.position.set(constrainedX, constrainedY, constrainedZ);
    newModel.name = `Model_${randomIndex + 1}_${Date.now()}`;

    this.group.add(newModel);

    this.startFalling(newModel);
  }

  public getRenderer(): WebGLRenderer {
    return this.renderer;
  }

  public dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.renderer.dispose();
    this.controls.dispose();
    window.removeEventListener('resize', this.onWindowResize);
  }

  private createScene(): void {
    this.scene = new Scene();
    this.scene.background = new Color(0x808080);
  }

  private createCamera(): void {
    this.camera = new PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 0, 7);
  }

  private createControls(): void {
    this.controls = new OrbitControls(this.camera, this.container);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  private createFloorAndWalls(): void {
    const roomWidth = ROOM_WIDTH;
    const roomHeight = ROOM_HEIGHT;
    const roomDepth = ROOM_DEPTH;

    const floorGeometry = new PlaneGeometry(roomWidth, roomDepth);
    const floorMaterial = new ShadowMaterial({
      opacity: 0.5,
    });
    const floor = new Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const wallMaterial = new MeshBasicMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0.1,
      side: DoubleSide,
    });

    const frontWall = new Mesh(
      new PlaneGeometry(roomWidth, roomHeight),
      wallMaterial
    );
    frontWall.position.set(0, roomHeight / 2 - 0.5, -roomDepth / 2);
    this.scene.add(frontWall);

    const backWall = new Mesh(
      new PlaneGeometry(roomWidth, roomHeight),
      wallMaterial
    );
    backWall.position.set(0, roomHeight / 2 - 0.5, roomDepth / 2);
    backWall.rotation.y = Math.PI;
    this.scene.add(backWall);

    const leftWall = new Mesh(
      new PlaneGeometry(roomDepth, roomHeight),
      wallMaterial
    );
    leftWall.position.set(-roomWidth / 2, roomHeight / 2 - 0.5, 0);
    leftWall.rotation.y = Math.PI / 2;
    this.scene.add(leftWall);

    const rightWall = new Mesh(
      new PlaneGeometry(roomDepth, roomHeight),
      wallMaterial
    );
    rightWall.position.set(roomWidth / 2, roomHeight / 2 - 0.5, 0);
    rightWall.rotation.y = -Math.PI / 2;
    this.scene.add(rightWall);
  }

  private createLights(): void {
    this.scene.add(new HemisphereLight(0xffffff, 0x444444, 1));

    const light = new DirectionalLight(0xffffff, 1);
    light.position.set(0, ROOM_HEIGHT, 0);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.camera.near = 0.01;
    light.shadow.camera.far = 10;
    this.scene.add(light);
  }

  private createGroup(): void {
    this.group = new Group();
    this.scene.add(this.group);
  }

  private loadModels(): void {
    const radius = OBJECTS_DISTANCE_FROM_CAMERA;
    const models = MODELS;

    models.forEach((m, i) => {
      this.loader.load(
        `/models/${m}.glb`,
        (gltf) => {
          const model = gltf.scene;
          model.name = m;

          const angle = (i / models.length) * Math.PI * 2;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          model.position.set(x, 0, z);
          model.scale.setScalar(5);

          model.traverse((child) => {
            if (child instanceof Mesh) {
              child.castShadow = true;
            }
          });

          this.group.add(model);
          this.loadedModels.push(model.clone());

          this.startFalling(model);
        },
        undefined,
        () => {}
      );
    });
  }

  private createRenderer(): void {
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.xr.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    this.renderer.xr.addEventListener('sessionstart', () => {
      this.savedCameraPosition.copy(this.camera.position);
      this.savedCameraRotation.copy(this.camera.rotation);
      this.savedCameraQuaternion.copy(this.camera.quaternion);
      this.savedControlsTarget.copy(this.controls.target);

      this.savedCameraFov = this.camera.fov;
      this.savedCameraZoom = this.camera.zoom;
      this.savedCameraAspect = this.camera.aspect;

      this.controls.enabled = false;

      this.callbacks.onXRStart();
    });

    this.renderer.xr.addEventListener('sessionend', () => {
      this.controls.enabled = true;

      this.camera.position.copy(this.savedCameraPosition);
      this.camera.rotation.copy(this.savedCameraRotation);
      this.camera.quaternion.copy(this.savedCameraQuaternion);

      this.camera.fov = this.savedCameraFov;
      this.camera.zoom = this.savedCameraZoom;
      this.camera.aspect = this.savedCameraAspect;

      this.camera.updateProjectionMatrix();

      this.controls.target.copy(this.savedControlsTarget);

      this.camera.updateMatrixWorld(true);

      this.controls.update();

      this.callbacks.onXREnd();

      if (this.controller1.userData.selected !== undefined) {
        this.controller1.userData.selected = undefined;
        this.controller1.userData.selectedOffset = undefined;
      }
      if (this.controller2.userData.selected !== undefined) {
        this.controller2.userData.selected = undefined;
        this.controller2.userData.selectedOffset = undefined;
      }

      if (this.lastHoveredObjectName) {
        const polygonCount = this.getPolygonCount(
          this.scene.getObjectByName(this.lastHoveredObjectName) ||
            new Object3D()
        );
        this.callbacks.onObjectHovered(
          this.lastHoveredObjectName,
          polygonCount
        );
      }

      this.callbacks.onObjectHovered(null, 0);

      this.fallingObjects.clear();
      this.lastButtonStates.clear();
    });
  }

  private setupControllers(): void {
    this.controller1 = this.renderer.xr.getController(0);
    this.controller2 = this.renderer.xr.getController(1);

    const controllerEvents: Array<
      [string, (event: TXRControllerEvent) => void]
    > = [
      ['selectstart', this.onSelectStart.bind(this)],
      ['selectend', this.onSelectEnd.bind(this)],
      ['disconnected', this.onControllerDisconnected.bind(this)],
      ['connected', this.onControllerConnected.bind(this)],
    ];

    [this.controller1, this.controller2].forEach((controller) => {
      controllerEvents.forEach(([eventName, handler]) => {
        (controller as unknown as EventTarget).addEventListener(
          eventName,
          handler as unknown as EventListener
        );
      });
      this.scene.add(controller);
    });

    const controllerModelFactory = new XRControllerModelFactory();
    [
      this.renderer.xr.getControllerGrip(0),
      this.renderer.xr.getControllerGrip(1),
    ].forEach((grip) => {
      grip.add(controllerModelFactory.createControllerModel(grip));
      this.scene.add(grip);
    });

    const lineGeometry = new BufferGeometry().setFromPoints([
      new Vector3(0, 0, 0),
      new Vector3(0, 0, -1),
    ]);
    const lineTemplate = new Line(lineGeometry);
    lineTemplate.name = 'line';
    lineTemplate.scale.z = 5;

    const markerGeometry = new SphereGeometry(0.02, 16, 16);
    const markerMaterial = new MeshBasicMaterial({ color: 0xffffff });
    const markerTemplate = new Mesh(markerGeometry, markerMaterial);
    markerTemplate.name = 'marker';
    markerTemplate.position.set(0, 0, -1);

    [this.controller1, this.controller2].forEach((controller) => {
      const line = lineTemplate.clone();
      const marker = markerTemplate.clone();
      line.add(marker);
      controller.add(line);
    });

    this.raycaster = new Raycaster();

    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  private startRendering(): void {
    this.renderer.setAnimationLoop(this.animate.bind(this));
  }

  private onWindowResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private onSelectStart(event: TXRControllerEvent): void {
    const controller = event.target;
    const intersections = this.getIntersections(controller);

    if (intersections.length > 0) {
      const intersection = intersections[0];
      const object = intersection.object;

      let targetObject: Object3D = object;
      while (targetObject.parent && targetObject.parent !== this.group) {
        targetObject = targetObject.parent;
      }

      targetObject.traverse((child) => {
        if (child instanceof Mesh && child.material) {
          if (child.material instanceof MeshStandardMaterial) {
            child.material.emissive.setHex(0x0000ff);
          }
        }
      });

      controller.userData.selected = targetObject;

      const worldOffset = new Vector3()
        .copy(targetObject.position)
        .sub(controller.position);

      const localOffset = controller.worldToLocal(
        controller.position.clone().add(worldOffset)
      );

      controller.userData.selectedOffset = localOffset;

      this.stopFalling(targetObject);

      const polygonCount = this.getPolygonCount(targetObject);
      const objectName = targetObject.name || 'Object';

      this.callbacks.onObjectSelected(objectName, polygonCount);
    }
  }

  private onSelectEnd(event: TXRControllerEvent): void {
    const controller = event.target;

    if (controller.userData.selected !== undefined) {
      const object = controller.userData.selected;

      object.traverse((child: Object3D) => {
        if (child instanceof Mesh && child.material) {
          if (child.material instanceof MeshStandardMaterial) {
            child.material.emissive.setHex(0x000000);
          }
        }
      });

      this.constrainObjectPosition(object);

      this.group.attach(object);
      controller.userData.selected = undefined;
      controller.userData.selectedOffset = undefined;

      this.startFalling(object);

      this.callbacks.onObjectSelected(null, 0);
    }
  }

  private onControllerConnected(): void {}

  private onControllerDisconnected(): void {}

  private getIntersections(controller: XRTargetRaySpace) {
    controller.updateMatrixWorld();
    this.raycaster.setFromXRController(controller);
    return this.raycaster.intersectObjects(this.group.children, true);
  }

  private intersectObjects(controller: XRTargetRaySpace): void {
    if (controller.userData.targetRayMode === 'screen') return;

    if (controller.userData.selected !== undefined) return;

    const line = controller.getObjectByName('line');
    const intersections = this.getIntersections(controller);

    if (intersections.length > 0) {
      const intersection = intersections[0];
      const object = intersection.object;

      let targetObject: Object3D = object;
      while (targetObject.parent && targetObject.parent !== this.group) {
        targetObject = targetObject.parent;
      }

      targetObject.traverse((child) => {
        if (child instanceof Mesh && child.material) {
          if (child.material instanceof MeshStandardMaterial) {
            child.material.emissive.setHex(0xff0000);
            this.intersected.push(child);
          }
        }
      });

      if (line) {
        line.scale.z = intersection.distance;
      }
    } else {
      if (line) {
        line.scale.z = 5;
      }
    }
  }

  private updateHoverState(): void {
    let closestIntersection: Intersection | null = null;
    let closestController: XRTargetRaySpace | null = null;

    if (this.controller1.userData.selected === undefined) {
      const intersections1 = this.getIntersections(this.controller1);
      if (intersections1.length > 0) {
        closestIntersection = intersections1[0];
        closestController = this.controller1;
      }
    }

    if (this.controller2.userData.selected === undefined) {
      const intersections2 = this.getIntersections(this.controller2);
      if (intersections2.length > 0) {
        if (
          !closestIntersection ||
          intersections2[0].distance < closestIntersection.distance
        ) {
          closestIntersection = intersections2[0];
          closestController = this.controller2;
        }
      }
    }

    if (closestIntersection && closestController) {
      const object = closestIntersection.object;

      let targetObject: Object3D = object;
      while (targetObject.parent && targetObject.parent !== this.group) {
        targetObject = targetObject.parent;
      }

      const objectName = targetObject.name || 'Object';
      if (this.lastHoveredObjectName !== objectName) {
        this.lastHoveredObjectName = objectName;
        const polygonCount = this.getPolygonCount(targetObject);
        console.log('Тип объекта: ', targetObject.type);
        this.callbacks.onObjectHovered(objectName, polygonCount);
      }
    } else {
      if (this.lastHoveredObjectName !== null) {
        this.lastHoveredObjectName = null;
        this.callbacks.onObjectHovered(null, 0);
      }
    }
  }

  private cleanIntersected(): void {
    while (this.intersected.length) {
      const object = this.intersected.pop();
      if (object instanceof Mesh && object.material) {
        if (object.material instanceof MeshStandardMaterial) {
          let isPartOfSelected = false;

          if (this.controller1.userData.selected !== undefined) {
            this.controller1.userData.selected.traverse((child: Object3D) => {
              if (child === object) {
                isPartOfSelected = true;
              }
            });
          }

          if (this.controller2.userData.selected !== undefined) {
            this.controller2.userData.selected.traverse((child: Object3D) => {
              if (child === object) {
                isPartOfSelected = true;
              }
            });
          }

          if (!isPartOfSelected) {
            object.material.emissive.setHex(0x000000);
          }
        }
      }
    }
  }

  private animate(): void {
    this.fallingObjects.forEach((fallData, object) => {
      if (fallData.isFalling) {
        fallData.velocity += this.gravity;
        object.position.y += fallData.velocity;

        const bbox = new Box3().setFromObject(object);

        if (bbox.min.y <= this.floorY) {
          object.position.y += this.floorY - bbox.min.y;
          fallData.velocity = 0;
          fallData.isFalling = false;
        }

        this.constrainObjectPosition(object);
      }
    });

    if (
      this.controller1.userData.selected !== undefined &&
      this.controller1.userData.selectedOffset !== undefined
    ) {
      const object = this.controller1.userData.selected;
      const localOffset = this.controller1.userData.selectedOffset;

      const worldOffset = this.controller1.localToWorld(localOffset.clone());

      const desiredPosition = worldOffset;

      object.position.copy(desiredPosition);

      this.constrainObjectPosition(object);

      const wasConstrained = !object.position.equals(desiredPosition);

      if (wasConstrained) {
        object.traverse((child: Object3D) => {
          if (child instanceof Mesh && child.material) {
            if (child.material instanceof MeshStandardMaterial) {
              child.material.emissive.setHex(0xff0000);
              setTimeout(() => {
                child.material.emissive.setHex(0x0000ff);
              }, 100);
            }
          }
        });
      }
    }

    if (
      this.controller2.userData.selected !== undefined &&
      this.controller2.userData.selectedOffset !== undefined
    ) {
      const object = this.controller2.userData.selected;
      const localOffset = this.controller2.userData.selectedOffset;

      const worldOffset = this.controller2.localToWorld(localOffset.clone());

      const desiredPosition = worldOffset;

      object.position.copy(desiredPosition);

      this.constrainObjectPosition(object);

      const wasConstrained = !object.position.equals(desiredPosition);

      if (wasConstrained) {
        object.traverse((child: Object3D) => {
          if (child instanceof Mesh && child.material) {
            if (child.material instanceof MeshStandardMaterial) {
              child.material.emissive.setHex(0xff0000);
              setTimeout(() => {
                child.material.emissive.setHex(0x0000ff);
              }, 100);
            }
          }
        });
      }
    }

    this.cleanIntersected();
    this.intersectObjects(this.controller1);
    this.intersectObjects(this.controller2);
    this.updateHoverState();

    this.checkButtonPress();

    this.renderer.render(this.scene, this.camera);
  }

  private getObjectBounds(object: Object3D) {
    const bbox = new Box3().setFromObject(object);
    const size = new Vector3();
    bbox.getSize(size);
    return { bbox, size };
  }

  private constrainObjectPosition(object: Object3D): void {
    let { bbox, size } = this.getObjectBounds(object);
    const position = object.position;

    const halfSizeX = size.x / 2;
    const halfSizeZ = size.z / 2;

    if (position.x - halfSizeX < this.roomBounds.minX) {
      position.x = this.roomBounds.minX + halfSizeX;
    } else if (position.x + halfSizeX > this.roomBounds.maxX) {
      position.x = this.roomBounds.maxX - halfSizeX;
    }

    if (position.z - halfSizeZ < this.roomBounds.minZ) {
      position.z = this.roomBounds.minZ + halfSizeZ;
    } else if (position.z + halfSizeZ > this.roomBounds.maxZ) {
      position.z = this.roomBounds.maxZ - halfSizeZ;
    }

    bbox = new Box3().setFromObject(object);

    if (bbox.min.y < this.roomBounds.minY) {
      position.y += this.roomBounds.minY - bbox.min.y;
    } else if (bbox.max.y > this.roomBounds.maxY) {
      position.y -= bbox.max.y - this.roomBounds.maxY;
    }
  }

  private startFalling(object: Object3D): void {
    this.fallingObjects.set(object, { velocity: 0, isFalling: true });
  }

  private stopFalling(object: Object3D): void {
    this.fallingObjects.delete(object);
  }

  private getPolygonCount(object: Object3D): number {
    let count = 0;
    object.traverse((child) => {
      if (child instanceof Mesh && child.geometry) {
        const geometry = child.geometry;
        if (geometry.index) {
          count += geometry.index.count / 3;
        } else if (geometry.attributes.position) {
          count += geometry.attributes.position.count / 3;
        }
      }
    });
    return Math.floor(count);
  }

  private deleteObject(object: Object3D): void {
    this.group.remove(object);

    object.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });

    this.callbacks.onObjectSelected(null, 0);
  }

  private handleDeleteButton(): void {
    if (this.controller2.userData.selected !== undefined) {
      const selectedObject = this.controller2.userData.selected;
      this.controller2.userData.selected = undefined;
      this.deleteObject(selectedObject);
      return;
    }

    if (this.intersected.length > 0) {
      const targetObject = this.intersected[0];
      if (!targetObject) return;

      let parentObject: Object3D = targetObject;
      while (parentObject.parent && parentObject.parent !== this.group) {
        parentObject = parentObject.parent;
      }

      this.deleteObject(parentObject);
      return;
    }

    const intersections = this.getIntersections(this.controller2);
    if (intersections.length > 0) {
      const intersection = intersections[0];
      const object = intersection.object;
      if (!object) return;

      let targetObject: Object3D = object;
      while (targetObject.parent && targetObject.parent !== this.group) {
        targetObject = targetObject.parent;
      }

      this.deleteObject(targetObject);
    }
  }

  private checkButtonPress(): void {
    const session = this.renderer.xr.getSession();
    if (!session) return;

    for (let i = 0; i < session.inputSources.length; i++) {
      const inputSource = session.inputSources[i];

      if (inputSource?.gamepad) {
        const gamepad = inputSource.gamepad;
        const currentStates = gamepad.buttons.map((btn) => btn.pressed);
        const previousStates = this.lastButtonStates.get(i) || [];

        gamepad.buttons.forEach((button: TGamepadButton, index: number) => {
          const wasPressed = previousStates[index] || false;
          const isPressed = button.pressed;

          if (isPressed && !wasPressed) {
            if (i === 1 && index === 4) {
              this.handleDeleteButton();
            }
          }
        });

        this.lastButtonStates.set(i, currentStates);
      }
    }
  }
}
