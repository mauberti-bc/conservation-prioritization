import Box from '@mui/material/Box';
import { useMapContext } from 'hooks/useContext';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as pmtiles from 'pmtiles';
import { useEffect, useRef } from 'react';

type MapContainerProps = {
  pmtilesUrls?: string[];
};

export const MapContainer = ({ pmtilesUrls = [] }: MapContainerProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { mapRef } = useMapContext();
  const protocolRef = useRef<pmtiles.Protocol | null>(null);

  // Register PMTiles protocol once
  useEffect(() => {
    if (protocolRef.current) {
      return;
    }

    protocolRef.current = new pmtiles.Protocol();
    maplibregl.addProtocol('pmtiles', protocolRef.current.tile);
  }, []);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) {
      return;
    }

    // Initialize map with default style (empty vector base)
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [],
      },
      center: [-125, 55],
      zoom: 5,
      maxZoom: 11,
    });

    mapRef.current = map;

    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      // Add OSM tile source
      if (!map.getSource('osm')) {
        map.addSource('osm', {
          type: 'raster',
          tiles: [
            'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
        });

        map.addLayer({
          id: 'osm-tiles',
          type: 'raster',
          source: 'osm',
          minzoom: 0,
          maxzoom: 19,
        });
      }

      updatePmtilesLayers(map, pmtilesUrls);
    });

    mapRef.current = map;
  }, [mapRef, pmtilesUrls]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (!map.isStyleLoaded()) {
      map.once('load', () => {
        updatePmtilesLayers(map, pmtilesUrls);
      });
      return;
    }

    updatePmtilesLayers(map, pmtilesUrls);
  }, [mapRef, pmtilesUrls]);

  return <Box ref={containerRef} sx={{ width: '100%', height: '100%' }} />;
};

const updatePmtilesLayers = (map: maplibregl.Map, pmtilesUrls: string[]) => {
  const sourcePrefix = 'pmtiles-';
  const layerPrefix = 'pmtiles-layer-';

  const style = map.getStyle();

  if (style.layers) {
    style.layers
      .filter((layer) => layer.id.startsWith(layerPrefix))
      .forEach((layer) => {
        if (map.getLayer(layer.id)) {
          map.removeLayer(layer.id);
        }
      });
  }

  if (style.sources) {
    Object.keys(style.sources)
      .filter((sourceId) => sourceId.startsWith(sourcePrefix))
      .forEach((sourceId) => {
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }
      });
  }

  pmtilesUrls.forEach((url, index) => {
    const sourceId = `${sourcePrefix}${index}`;
    const layerId = `${layerPrefix}${index}`;

    map.addSource(sourceId, {
      type: 'raster',
      url,
      tileSize: 256,
    });

    map.addLayer({
      id: layerId,
      type: 'raster',
      source: sourceId,
      paint: { 'raster-opacity': 0.75 },
      minzoom: 0,
      maxzoom: 12,
    });
  });
};
