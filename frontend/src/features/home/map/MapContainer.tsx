import { CircularProgress } from '@mui/material';
import Box from '@mui/material/Box';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { useMapContext } from 'hooks/useContext';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { attachMapContainer, detachMapContainer, getMapCacheEntry, setMapCacheEntry } from 'utils/mapInstanceCache';
import { ensurePMTilesProtocol } from 'utils/pmtilesProtocol';

interface MapContainerProps {
  pmtilesUrls?: string[];
  keepAliveKey?: string;
  useSharedContext?: boolean;
  interactive?: boolean;
  showNavigationControl?: boolean;
  showBaseLayer?: boolean;
  pmtilesOpacity?: number;
  onPmtilesDisplayed?: (displayed: boolean) => void;
  waitForPmtiles?: boolean;
}

/**
 * Map container with optional instance caching to avoid remounting.
 *
 * @param {MapContainerProps} props
 * @returns {JSX.Element}
 */
export const MapContainer = ({
  pmtilesUrls = [],
  keepAliveKey,
  useSharedContext = true,
  interactive = true,
  showNavigationControl = true,
  showBaseLayer = true,
  pmtilesOpacity = 0.75,
  onPmtilesDisplayed,
  waitForPmtiles = true,
}: MapContainerProps) => {
  const PmtilesSourcePrefix = 'pmtiles-source-';
  const PmtilesLayerPrefix = 'pmtiles-layer-';
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const { mapRef: sharedMapRef, setIsMapReady } = useMapContext();
  const localMapRef = useRef<maplibregl.Map | null>(null);
  const mapRef = useSharedContext ? sharedMapRef : localMapRef;
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [areLayersLoaded, setAreLayersLoaded] = useState(false);
  const [styleReadyTick, setStyleReadyTick] = useState(0);
  const addedLayerIdsRef = useRef<Set<string>>(new Set());
  const addedSourceIdsRef = useRef<Set<string>>(new Set());
  const sourceUrlBySourceIdRef = useRef<globalThis.Map<string, string>>(new globalThis.Map());
  const normalizedPmtilesUrls = useMemo(() => {
    return pmtilesUrls.filter((url) => {
      return Boolean(url);
    });
  }, [pmtilesUrls]);
  const hasPmtiles = normalizedPmtilesUrls.length > 0;
  const hasRenderedPmtiles = hasAnyPmtilesLayers(mapRef.current, PmtilesLayerPrefix);

  const isMapLoading = !isMapInitialized || (waitForPmtiles && hasPmtiles && !areLayersLoaded && !hasRenderedPmtiles);

  useEffect(() => {
    if (!onPmtilesDisplayed) {
      return;
    }

    onPmtilesDisplayed(hasPmtiles && (areLayersLoaded || hasRenderedPmtiles));
  }, [areLayersLoaded, hasPmtiles, hasRenderedPmtiles, onPmtilesDisplayed]);

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
        hydratePmtilesTrackingFromStyle(
          cached.map,
          PmtilesSourcePrefix,
          PmtilesLayerPrefix,
          addedSourceIdsRef.current,
          addedLayerIdsRef.current,
          sourceUrlBySourceIdRef.current
        );

        let didHandleReady = false;
        const handleReady = () => {
          if (didHandleReady) {
            return;
          }

          didHandleReady = true;
          ensureBaseLayer(cached.map, showBaseLayer);
          setIsMapInitialized(true);
          setStyleReadyTick((prev) => {
            return prev + 1;
          });
          if (useSharedContext) {
            setIsMapReady(true);
          }
        };

        if (cached.map.isStyleLoaded()) {
          handleReady();
        } else {
          cached.map.once('styledata', handleReady);
          cached.map.once('load', handleReady);
        }

        cached.map.resize();
        cached.map.triggerRepaint();

        return () => {
          didHandleReady = true;
          detachMapContainer(cached);
          mapRef.current = null;
          setIsMapInitialized(false);
          setAreLayersLoaded(false);
          if (useSharedContext) {
            setIsMapReady(false);
          }
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
      center: [-125, 50],
      zoom: 3,
      maxZoom: 11,
      interactive,
    });

    if (showNavigationControl) {
      map.addControl(new maplibregl.NavigationControl(), 'top-right');
    }

    let didHandleMapReady = false;
    const handleMapReady = () => {
      if (didHandleMapReady) {
        return;
      }

      didHandleMapReady = true;
      ensureBaseLayer(map, showBaseLayer);
      setIsMapInitialized(true);
      setStyleReadyTick((prev) => {
        return prev + 1;
      });
      if (useSharedContext) {
        setIsMapReady(true);
      }
    };

    map.once('styledata', handleMapReady);
    map.once('load', handleMapReady);
    if (map.isStyleLoaded()) {
      handleMapReady();
    }

    mapRef.current = map;

    if (keepAliveKey) {
      setMapCacheEntry(keepAliveKey, { map, container: innerContainer });
    }

    return () => {
      didHandleMapReady = true;
      if (keepAliveKey) {
        detachMapContainer({ map, container: innerContainer });
      } else {
        map.remove();
        mapHost.replaceChildren();
      }
      mapRef.current = null;
      setIsMapInitialized(false);
      setAreLayersLoaded(false);
      if (useSharedContext) {
        setIsMapReady(false);
      }
    };
  }, [interactive, keepAliveKey, mapRef, setIsMapReady, showBaseLayer, showNavigationControl, useSharedContext]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapInitialized || !map.isStyleLoaded()) {
      return;
    }

    ensureBaseLayer(map, showBaseLayer);
  }, [isMapInitialized, mapRef, showBaseLayer]);

  useEffect(() => {
    const map = mapRef.current;
    const host = mapHostRef.current;

    if (!map || !host) {
      return undefined;
    }

    const handleResize = () => {
      map.resize();
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    resizeObserver.observe(host);
    handleResize();

    return () => {
      resizeObserver.disconnect();
    };
  }, [mapRef, isMapInitialized]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapInitialized) {
      return undefined;
    }

    if (!normalizedPmtilesUrls.length) {
      removeStalePmtilesLayersAndSources(
        map,
        new Set(),
        new Set(),
        addedLayerIdsRef.current,
        addedSourceIdsRef.current,
        sourceUrlBySourceIdRef.current
      );
      setAreLayersLoaded(true);
      return undefined;
    }

    if (!map.isStyleLoaded()) {
      let didNotify = false;
      let notifyTimer: number | null = null;
      const notifyStyleReady = () => {
        if (didNotify) {
          return;
        }

        didNotify = true;
        if (notifyTimer !== null) {
          window.clearTimeout(notifyTimer);
          notifyTimer = null;
        }
        setStyleReadyTick((prev) => {
          return prev + 1;
        });
      };
      map.once('styledata', notifyStyleReady);
      map.once('load', notifyStyleReady);
      notifyTimer = window.setTimeout(() => {
        notifyStyleReady();
      }, 800);

      return () => {
        didNotify = true;
        if (notifyTimer !== null) {
          window.clearTimeout(notifyTimer);
          notifyTimer = null;
        }
      };
    }

    let cancelled = false;
    setAreLayersLoaded(false);

    const applyLayers = async () => {
      let didMarkLoaded = false;
      let fallbackTimer: number | null = null;
      const markLoaded = () => {
        if (didMarkLoaded || cancelled) {
          return;
        }

        didMarkLoaded = true;
        if (fallbackTimer) {
          window.clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
        setAreLayersLoaded(true);
      };

      try {
        await updatePmtilesLayers(
          map,
          normalizedPmtilesUrls,
          pmtilesOpacity,
          PmtilesSourcePrefix,
          PmtilesLayerPrefix,
          addedLayerIdsRef.current,
          addedSourceIdsRef.current,
          sourceUrlBySourceIdRef.current
        );
      } catch (error) {
        console.error('Failed to apply PMTiles layers', error);
        markLoaded();
        return;
      }

      const handleIdle = () => {
        markLoaded();
      };

      map.once('idle', handleIdle);
      map.triggerRepaint();
      fallbackTimer = window.setTimeout(() => {
        markLoaded();
      }, 1500);
    };

    void applyLayers();

    return () => {
      cancelled = true;
    };
  }, [isMapInitialized, mapRef, normalizedPmtilesUrls, pmtilesOpacity, styleReadyTick]);

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
 *
 * @param {maplibregl.Map} map
 * @returns {void}
 */
const ensureBaseLayer = (map: maplibregl.Map, showBaseLayer: boolean): void => {
  if (!showBaseLayer) {
    if (map.getLayer('osm-tiles')) {
      map.removeLayer('osm-tiles');
    }

    if (map.getSource('osm')) {
      map.removeSource('osm');
    }

    return;
  }

  if (!map.getSource('osm')) {
    map.addSource('osm', {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
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

  const style = map.getStyle();
  if (!style || !style.layers) {
    return;
  }

  const firstNonBaseLayerId = style.layers?.find((layer) => {
    return layer.id !== 'osm-tiles';
  })?.id;

  if (firstNonBaseLayerId && map.getLayer('osm-tiles')) {
    map.moveLayer('osm-tiles', firstNonBaseLayerId);
  }
};

/**
 * Replace PMTiles layers with the provided list of archive URLs.
 *
 * @param {maplibregl.Map} map
 * @param {string[]} pmtilesUrls
 * @returns {void}
 */
const updatePmtilesLayers = async (
  map: maplibregl.Map,
  pmtilesUrls: string[],
  pmtilesOpacity: number,
  sourcePrefix: string,
  layerPrefix: string,
  trackedLayerIds: Set<string>,
  trackedSourceIds: Set<string>,
  sourceUrlBySourceId: globalThis.Map<string, string>
): Promise<void> => {
  const desiredSourceIds = new Set<string>();
  const desiredLayerIds = new Set<string>();

  for (const url of pmtilesUrls) {
    const stableUrlKey = getStableTilesetUrlKey(url);
    const sourceId = `${sourcePrefix}${toMapIdentifier(stableUrlKey)}`;
    const layerId = `${layerPrefix}${toMapIdentifier(stableUrlKey)}`;
    const hasSource = Boolean(map.getSource(sourceId));
    const currentSourceUrl = sourceUrlBySourceId.get(sourceId);
    const shouldRefreshSource = hasSource && currentSourceUrl !== url;

    desiredSourceIds.add(sourceId);
    desiredLayerIds.add(layerId);

    if (shouldRefreshSource) {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
      trackedLayerIds.delete(layerId);
      trackedSourceIds.delete(sourceId);
    }

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'raster',
        url: resolvePmtilesSourceUrl(url),
        tileSize: 512,
      });
      trackedSourceIds.add(sourceId);
    }
    sourceUrlBySourceId.set(sourceId, url);

    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: { 'raster-opacity': pmtilesOpacity },
        minzoom: 0,
        maxzoom: 12,
      });
      trackedLayerIds.add(layerId);
    } else {
      map.setPaintProperty(layerId, 'raster-opacity', pmtilesOpacity);
    }
  }

  removeStalePmtilesLayersAndSources(
    map,
    desiredLayerIds,
    desiredSourceIds,
    trackedLayerIds,
    trackedSourceIds,
    sourceUrlBySourceId
  );
};

/**
 * Removes PMTiles layers and sources that are no longer desired.
 *
 * @param {maplibregl.Map} map
 * @param {Set<string>} desiredLayerIds
 * @param {Set<string>} desiredSourceIds
 * @param {Set<string>} trackedLayerIds
 * @param {Set<string>} trackedSourceIds
 * @param {Map<string, string>} sourceUrlBySourceId
 * @returns {void}
 */
const removeStalePmtilesLayersAndSources = (
  map: maplibregl.Map,
  desiredLayerIds: Set<string>,
  desiredSourceIds: Set<string>,
  trackedLayerIds: Set<string>,
  trackedSourceIds: Set<string>,
  sourceUrlBySourceId: globalThis.Map<string, string>
): void => {
  trackedLayerIds.forEach((layerId) => {
    if (desiredLayerIds.has(layerId)) {
      return;
    }

    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    trackedLayerIds.delete(layerId);
  });

  trackedSourceIds.forEach((sourceId) => {
    if (desiredSourceIds.has(sourceId)) {
      return;
    }

    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
    trackedSourceIds.delete(sourceId);
    sourceUrlBySourceId.delete(sourceId);
  });
};

/**
 * Checks if any PMTiles layer currently exists on the map.
 *
 * @param {maplibregl.Map | null} map
 * @param {string} layerPrefix
 * @returns {boolean}
 */
const hasAnyPmtilesLayers = (map: maplibregl.Map | null, layerPrefix: string): boolean => {
  if (!map) {
    return false;
  }

  const style = map.getStyle();
  if (!style?.layers) {
    return false;
  }

  return style.layers.some((layer) => {
    return layer.id.startsWith(layerPrefix);
  });
};

/**
 * Normalizes PMTiles URLs for stable source/layer identity.
 *
 * @param {string} tilesetUrl
 * @returns {string}
 */
const getStableTilesetUrlKey = (tilesetUrl: string): string => {
  try {
    const parsed = new URL(tilesetUrl);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    const hashSplit = tilesetUrl.split('#')[0];
    return hashSplit.split('?')[0];
  }
};

/**
 * Resolves a PMTiles source URL with the pmtiles protocol prefix.
 *
 * @param {string} url
 * @returns {string}
 */
const resolvePmtilesSourceUrl = (url: string): string => {
  if (url.startsWith('pmtiles://')) {
    return url;
  }

  return `pmtiles://${url}`;
};

/**
 * Converts a string value into a map-safe identifier suffix.
 *
 * @param {string} value
 * @returns {string}
 */
const toMapIdentifier = (value: string): string => {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
};

/**
 * Rehydrates tracked PMTiles source/layer IDs from the active map style.
 *
 * @param {maplibregl.Map} map
 * @param {string} sourcePrefix
 * @param {string} layerPrefix
 * @param {Set<string>} trackedSourceIds
 * @param {Set<string>} trackedLayerIds
 * @param {Map<string, string>} sourceUrlBySourceId
 * @returns {void}
 */
const hydratePmtilesTrackingFromStyle = (
  map: maplibregl.Map,
  sourcePrefix: string,
  layerPrefix: string,
  trackedSourceIds: Set<string>,
  trackedLayerIds: Set<string>,
  sourceUrlBySourceId: globalThis.Map<string, string>
): void => {
  trackedSourceIds.clear();
  trackedLayerIds.clear();
  sourceUrlBySourceId.clear();

  const style = map.getStyle();
  if (!style) {
    return;
  }

  if (style.sources) {
    Object.entries(style.sources).forEach(([sourceId, source]) => {
      if (!sourceId.startsWith(sourcePrefix)) {
        return;
      }

      trackedSourceIds.add(sourceId);
      const sourceUrl = (source as { url?: string }).url;
      if (!sourceUrl) {
        return;
      }

      sourceUrlBySourceId.set(sourceId, sourceUrl.replace(/^pmtiles:\/\//, ''));
    });
  }

  if (!style.layers) {
    return;
  }

  style.layers.forEach((layer) => {
    if (!layer.id.startsWith(layerPrefix)) {
      return;
    }

    trackedLayerIds.add(layer.id);
  });
};
