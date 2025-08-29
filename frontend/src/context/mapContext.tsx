import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { DrawControlsProps } from 'features/home/map/draw/DrawControls';
import { Map } from 'maplibre-gl';
import { createContext, createRef } from 'react';

interface MapContextType {
  mapRef: React.RefObject<Map | null>;
  drawRef: React.RefObject<MapboxDraw | null>;
  drawControlsRef: React.RefObject<DrawControlsProps | null>;
}

const mapRef = createRef<Map>();
const drawRef = createRef<MapboxDraw>();
const drawControlsRef = createRef<DrawControlsProps>();

export const MapContext = createContext<MapContextType | undefined>(undefined);

interface MapContextProviderProps {
  children: React.ReactNode;
}

/**
 * Provides mapRef and drawRef to all children components via context.
 */
export const MapContextProvider = ({ children }: MapContextProviderProps) => {
  return <MapContext.Provider value={{ mapRef, drawRef, drawControlsRef }}>{children}</MapContext.Provider>;
};
