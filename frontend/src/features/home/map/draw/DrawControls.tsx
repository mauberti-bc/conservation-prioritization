import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { blue } from '@mui/material/colors';
import { Feature } from 'geojson';
import { useMapContext } from 'hooks/useContext';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

export interface DrawControlsProps {
  startDrawing: () => void;
  submit: (callback: (features: Feature[]) => void) => void;
  clearDrawing: () => void;
}

export const DrawControls = forwardRef<DrawControlsProps>((_, ref) => {
  const { mapRef, drawRef } = useMapContext();
  const submitCallbackRef = useRef<((features: Feature[]) => void) | null>(null);

  // Function to ensure draw layers are on top
  const ensureDrawLayersOnTop = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    // List of all possible Mapbox Draw layer IDs
    const drawLayerIds = [
      'gl-draw-polygon-fill-inactive',
      'gl-draw-polygon-fill-active',
      'gl-draw-polygon-stroke-inactive',
      'gl-draw-polygon-stroke-active',
      'gl-draw-line-inactive',
      'gl-draw-line-active',
      'gl-draw-point-point-stroke-inactive',
      'gl-draw-point-inactive',
      'gl-draw-point-stroke-active',
      'gl-draw-point-active',
      // Custom style layer IDs
      'gl-draw-polygon-fill',
      'gl-draw-polygon-stroke',
    ];

    // Move each draw layer to the top if it exists
    drawLayerIds.forEach((layerId) => {
      if (map.getLayer(layerId)) {
        try {
          map.moveLayer(layerId);
        } catch (error) {
          // Layer might not exist or already be at the top
          console.debug(`Could not move layer ${layerId}:`, error);
        }
      }
    });
  }, [mapRef]);

  const startDrawing = () => {
    const map = mapRef.current;
    if (!map || !drawRef.current) {
      return;
    }
    drawRef.current.changeMode('draw_polygon');
    map.getCanvas().style.cursor = 'crosshair';

    // Ensure draw layers are on top when starting to draw
    ensureDrawLayersOnTop();
  };

  const submit = (callback: (features: Feature[]) => void) => {
    submitCallbackRef.current = callback;
    if (!mapRef.current || !drawRef.current) {
      return;
    }
    const features = drawRef.current.getAll().features;
    callback(features);
    drawRef.current.changeMode('simple_select');
    mapRef.current.getCanvas().style.cursor = '';
  };

  const clearDrawing = () => {
    drawRef.current?.deleteAll();
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || drawRef.current) {
      return;
    }

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      defaultMode: 'simple_select',
      styles: [
        {
          id: 'gl-draw-polygon-fill',
          type: 'fill',
          paint: {
            'fill-color': blue[500],
            'fill-opacity': 0.3,
          },
        },
        {
          id: 'gl-draw-polygon-stroke',
          type: 'line',
          paint: {
            'line-color': blue[800],
            'line-width': 3,
          },
        },
      ],
    });

    drawRef.current = draw;
    map.addControl(draw as unknown as maplibregl.IControl, 'top-right');

    // Ensure draw layers are on top after the map loads and layers are added
    const onMapLoad = () => {
      setTimeout(() => {
        ensureDrawLayersOnTop();
      }, 100); // Small delay to ensure all layers are rendered
    };

    // Listen for when new layers might be added that could cover draw layers
    const onMapSourceData = (e: any) => {
      if (e.isSourceLoaded && e.sourceId?.startsWith('pmtiles-')) {
        setTimeout(() => {
          ensureDrawLayersOnTop();
        }, 50);
      }
    };

    if (map.isStyleLoaded()) {
      onMapLoad();
    } else {
      map.once('load', onMapLoad);
    }

    // Ensure draw layers stay on top when new sources/layers are added
    map.on('sourcedata', onMapSourceData);
    map.on('styledata', ensureDrawLayersOnTop);

    // Cleanup event listeners
    return () => {
      map.off('sourcedata', onMapSourceData);
      map.off('styledata', ensureDrawLayersOnTop);
    };
  }, [mapRef, drawRef, ensureDrawLayersOnTop]);

  useImperativeHandle(ref, () => ({
    startDrawing,
    submit,
    clearDrawing,
  }));

  return null;
});
