import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { DrawControlsProps } from 'features/home/map/draw/DrawControls';
import { Map } from 'maplibre-gl';
import { createContext, useRef, useState } from 'react';

interface MapContextType {
  mapRef: React.RefObject<Map | null>;
  drawRef: React.RefObject<MapboxDraw | null>;
  drawControlsRef: React.RefObject<DrawControlsProps | null>;
  isMapReady: boolean;
  setIsMapReady: (ready: boolean) => void;
}

export const MapContext = createContext<MapContextType | undefined>(undefined);

interface MapContextProviderProps {
  children: React.ReactNode;
}

/**
 * Provides mapRef and drawRef to all children components via context.
 */
export const MapContextProvider = ({ children }: MapContextProviderProps) => {
  const mapRef = useRef<Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const drawControlsRef = useRef<DrawControlsProps | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  return (
    <MapContext.Provider
      value={{
        mapRef,
        drawRef,
        drawControlsRef,
        isMapReady,
        setIsMapReady,
      }}>
      {children}
    </MapContext.Provider>
  );
};
