export type TEngineCallbacks = {
  onXRStart: () => void;
  onXREnd: () => void;
  onObjectSelected: (name: string | null, polygons: number) => void;
  onObjectHovered: (name: string | null, polygons?: number) => void;
};
