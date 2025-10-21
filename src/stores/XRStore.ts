import { create } from 'zustand';

type TXRState = {
  selectedObject: string | null;
  hoveredObject: string | null;
  polygonCount: number;
  isInXR: boolean;
  xrSupported: boolean | null;
  setSelected: (name: string | null, polygons: number) => void;
  clearSelected: () => void;
  setHovered: (name: string | null, polygons?: number) => void;
  setXR: (inXR: boolean) => void;
  setXRSupported: (supported: boolean) => void;
};

export const useXRStore = create<TXRState>((set) => ({
  selectedObject: null,
  hoveredObject: null,
  polygonCount: 0,
  isInXR: false,
  xrSupported: null,

  setSelected: (name, polygons) =>
    set({ selectedObject: name, polygonCount: polygons }),

  clearSelected: () => set({ selectedObject: null, polygonCount: 0 }),

  setHovered: (name, polygons) =>
    set((state) => {
      const nextState: Partial<TXRState> = { hoveredObject: name };
      if (typeof polygons === 'number') {
        if (name !== null || state.selectedObject === null) {
          nextState.polygonCount = polygons;
        }
      }
      return nextState as TXRState;
    }),

  setXR: (inXR) => set({ isInXR: inXR }),

  setXRSupported: (supported) => set({ xrSupported: supported }),
}));
