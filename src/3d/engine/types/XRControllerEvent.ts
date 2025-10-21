import { Event, XRTargetRaySpace } from 'three';

export type TXRControllerEvent = Event & {
  target: XRTargetRaySpace;
};
