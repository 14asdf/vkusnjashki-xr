import React, { useEffect, useRef } from 'react';
import { useXRStore } from '@/stores';
import { XRPanel } from '@/components/XRPanel';
import {
  SceneContainer,
  CanvasContainer,
  XROverlay,
} from '@/components/XRScene';
import { Engine } from '@/3d/engine';
import { IEngine } from '@/3d/engine/interfaces';

export const XRScene: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<IEngine | null>(null);

  const setSelected = useXRStore((s) => s.setSelected);
  const setHovered = useXRStore((s) => s.setHovered);
  const setXR = useXRStore((s) => s.setXR);
  const setXRSupported = useXRStore((s) => s.setXRSupported);

  useEffect(() => {
    if ('xr' in navigator) {
      navigator.xr?.isSessionSupported('immersive-vr').then((supported) => {
        setXRSupported(supported);
      });
    } else {
      setXRSupported(false);
    }
  }, [setXRSupported]);

  const handleEnterXR = async () => {
    const engine = engineRef.current;
    if (!engine) return;

    const renderer = engine.getRenderer();

    try {
      const sessionInit: XRSessionInit = {
        optionalFeatures: [
          'local-floor',
          'bounded-floor',
          'hand-tracking',
          'layers',
        ],
      };

      if (overlayRef.current) {
        sessionInit.optionalFeatures?.push('dom-overlay');
        sessionInit.domOverlay = { root: overlayRef.current };
      }

      const session = await navigator.xr?.requestSession(
        'immersive-vr',
        sessionInit
      );

      if (session) {
        await renderer.xr.setSession(session);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleExitXR = async () => {
    const engine = engineRef.current;
    if (!engine) return;

    try {
      const session = engine.getRenderer().xr.getSession();
      if (session) {
        await session.end();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddObject = () => {
    engineRef.current?.addRandomObject();
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new Engine(containerRef.current, {
      onXRStart: () => setXR(true),
      onXREnd: () => setXR(false),
      onObjectSelected: (name, polygons) => setSelected(name, polygons),
      onObjectHovered: (name, polygons) => setHovered(name, polygons),
    });

    engine.init();
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [setSelected, setHovered, setXR]);

  return (
    <SceneContainer>
      <CanvasContainer ref={containerRef} />
      <XROverlay ref={overlayRef}>
        <XRPanel
          onEnterXR={handleEnterXR}
          onExitXR={handleExitXR}
          onAddObject={handleAddObject}
        />
      </XROverlay>
    </SceneContainer>
  );
};
