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

  // Register PMTiles protocol once
  useEffect(() => {
    const protocol = new pmtiles.Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
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

      // Add PMTiles sources and layers
      pmtilesUrls.forEach((url, index) => {
        const sourceId = `pmtiles-${index}`;
        const layerId = `pmtiles-layer-${index}`;

        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, {
            type: 'raster',
            url,
            tileSize: 256,
          });
        }

        if (!map.getLayer(layerId)) {
          map.addLayer({
            id: layerId,
            type: 'raster',
            source: sourceId,
            paint: { 'raster-opacity': 0.75 },
            minzoom: 0,
            maxzoom: 12,
          });
        }
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapRef, pmtilesUrls]);

  return <Box ref={containerRef} sx={{ width: '100%', height: '100%' }} />;
};
