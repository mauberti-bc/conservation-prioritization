import { CircularProgress } from '@mui/material';
import Box from '@mui/material/Box';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { useMapContext } from 'hooks/useContext';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { attachMapContainer, detachMapContainer, getMapCacheEntry, setMapCacheEntry } from 'utils/mapInstanceCache';
import { ensurePMTilesProtocol } from 'utils/pmtilesProtocol';

interface MapContainerProps {
  pmtilesUrls?: string[];
  keepAliveKey?: string;
}

/**
 * Map container with optional instance caching to avoid remounting.
 *
 * @param {MapContainerProps} props
 * @returns {JSX.Element}
 */
export const MapContainer = ({ pmtilesUrls = [], keepAliveKey }: MapContainerProps) => {
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const { mapRef, setIsMapReady } = useMapContext();
  const [isMapInitialized, setIsMapInitialized] = useState(false);

  // Only show spinner until the map itself is mounted — layer changes are silent.
  const isMapLoading = !isMapInitialized;

  // Mount / cache effect
  useEffect(() => {
    const mapHost = mapHostRef.current;
    if (!mapHost) {
      return undefined;
    }

    ensurePMTilesProtocol();

    if (keepAliveKey) {
      const cached = getMapCacheEntry(keepAliveKey);
      if (cached) {
        attachMapContainer(cached, mapHost);
        mapRef.current = cached.map;

        const handleReady = () => {
          ensureBaseLayer(cached.map);
          setIsMapInitialized(true);
          setIsMapReady(true);
        };

        if (cached.map.isStyleLoaded()) {
          handleReady();
        } else {
          cached.map.once('load', handleReady);
        }

        cached.map.resize();
        cached.map.triggerRepaint();

        return () => {
          detachMapContainer(cached);
          mapRef.current = null;
          setIsMapInitialized(false);
          setIsMapReady(false);
        };
      }
    }

    const innerContainer = document.createElement('div');
    innerContainer.style.width = '100%';
    innerContainer.style.height = '100%';
    mapHost.innerHTML = '';
    mapHost.appendChild(innerContainer);

    const map = new maplibregl.Map({
      container: innerContainer,
      style: {
        version: 8,
        sources: {},
        layers: [],
      },
      center: [-125, 55],
      zoom: 5,
      maxZoom: 11,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    const handleMapReady = () => {
      ensureBaseLayer(map);
      setIsMapInitialized(true);
      setIsMapReady(true);
    };

    if (map.isStyleLoaded()) {
      handleMapReady();
    } else {
      map.once('load', handleMapReady);
    }

    mapRef.current = map;

    if (keepAliveKey) {
      setMapCacheEntry(keepAliveKey, { map, container: innerContainer });
    }

    return () => {
      if (keepAliveKey) {
        detachMapContainer({ map, container: innerContainer });
      } else {
        map.remove();
        mapHost.replaceChildren();
      }
      mapRef.current = null;
      setIsMapInitialized(false);
      setIsMapReady(false);
    };
  }, [keepAliveKey, mapRef, setIsMapReady]);

  // Resize observer effect
  useEffect(() => {
    const map = mapRef.current;
    const host = mapHostRef.current;
    if (!map || !host) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(host);
    map.resize();

    return () => resizeObserver.disconnect();
  }, [mapRef, isMapInitialized]);

  // Layer update effect — runs silently whenever pmtilesUrls changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return undefined;
    }

    const apply = () => {
      ensureBaseLayer(map);
      updatePmtilesLayers(map, pmtilesUrls);
    };

    if (map.isStyleLoaded()) {
      apply();
    } else {
      map.once('load', apply);
    }

    return undefined;
  }, [mapRef, pmtilesUrls, isMapInitialized]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <Box ref={mapHostRef} sx={{ position: 'absolute', inset: 0 }} />
      <LoadingGuard
        isLoading={isMapLoading}
        isLoadingFallbackDelay={300}
        isLoadingFallback={
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              bgcolor: 'rgba(255,255,255,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}>
            <CircularProgress size={35} />
          </Box>
        }>
        <Box />
      </LoadingGuard>
    </Box>
  );
};

/**
 * Ensure the base OSM raster layer exists.
 */
const ensureBaseLayer = (map: maplibregl.Map): void => {
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
  }

  if (!map.getLayer('osm-tiles')) {
    map.addLayer({
      id: 'osm-tiles',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 19,
    });
  }
};

/**
 * Replace PMTiles layers with the provided list of archive URLs.
 */
const updatePmtilesLayers = (map: maplibregl.Map, pmtilesUrls: string[]): void => {
  const sourcePrefix = 'pmtiles-';
  const layerPrefix = 'pmtiles-layer-';

  const style = map.getStyle();

  // Remove old pmtiles layers
  style.layers
    ?.filter((layer) => layer.id.startsWith(layerPrefix))
    .forEach((layer) => {
      if (map.getLayer(layer.id)) {
        map.removeLayer(layer.id);
      }
    });

  // Remove old pmtiles sources
  Object.keys(style.sources ?? {})
    .filter((id) => id.startsWith(sourcePrefix))
    .forEach((id) => {
      if (map.getSource(id)) {
        map.removeSource(id);
      }
    });

  // Add new layers
  pmtilesUrls.forEach((url, index) => {
    const sourceId = `${sourcePrefix}${index}`;
    const layerId = `${layerPrefix}${index}`;

    const resolvedUrl =
      url.startsWith('pmtiles://') || url.startsWith('http://') || url.startsWith('https://')
        ? url.startsWith('pmtiles://')
          ? url
          : `pmtiles://${url}`
        : url;

    map.addSource(sourceId, {
      type: 'raster',
      url: resolvedUrl,
      tileSize: 512,
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
