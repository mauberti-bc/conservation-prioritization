import { CircularProgress } from '@mui/material';
import Box from '@mui/material/Box';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { BASEMAP } from 'constants/basemap';
import { TASK_TYPE } from 'hooks/interfaces/useTaskApi.interface';
import { useConfigContext, useMapContext } from 'hooks/useContext';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { PMTiles } from 'pmtiles';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createBasemapStyle, ensureBaseLayer } from 'utils/basemap';
import { attachMapContainer, detachMapContainer, getMapCacheEntry, setMapCacheEntry } from 'utils/mapInstanceCache';
import { ensurePMTilesProtocol } from 'utils/pmtilesProtocol';
import { GeoJsonBounds } from 'utils/spatial';
import { BasemapControl } from './BasemapControl';
import { PmtilesLegend } from './PmtilesLegend';

const PMTILES_LAYER_PREFIX = 'pmtiles-layer-';
const HAIDA_GWAII_INITIAL_CENTER: [number, number] = [-132.0, 53.25];
const HAIDA_GWAII_INITIAL_ZOOM = 4.5;

interface MapContainerProps {
  pmtilesUrls?: string[];
  keepAliveKey?: string;
  boundsRefreshKey?: string | number;
  fitBounds?: GeoJsonBounds | null;
  useSharedContext?: boolean;
  interactive?: boolean;
  showNavigationControl?: boolean;
  showBaseLayer?: boolean;
  pmtilesOpacity?: number;
  onPmtilesDisplayed?: (displayed: boolean) => void;
  waitForPmtiles?: boolean;
  showPmtilesLegend?: boolean;
  pmtilesLegendTaskType?: TASK_TYPE | null;
}

/**
 * Map container with optional instance caching to avoid remounting.
 *
 * @param {MapContainerProps} props Component properties.
 * @returns {JSX.Element} The rendered component.
 */
export const MapContainer = ({
  pmtilesUrls = [],
  keepAliveKey,
  boundsRefreshKey,
  fitBounds,
  useSharedContext = true,
  interactive = true,
  showNavigationControl = true,
  showBaseLayer = true,
  pmtilesOpacity = 0.75,
  onPmtilesDisplayed,
  waitForPmtiles = true,
  showPmtilesLegend = true,
  pmtilesLegendTaskType = null,
}: MapContainerProps) => {
  const DefaultFitBoundsPadding = 32;
  const DefaultFitBoundsMaxZoom = 14;
  const PmtilesSourcePrefix = 'pmtiles-source-';
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const config = useConfigContext();
  const { mapRef: sharedMapRef, setIsMapReady } = useMapContext();
  const localMapRef = useRef<maplibregl.Map | null>(null);
  const mapRef = useSharedContext ? sharedMapRef : localMapRef;
  const [layerOpacity, setLayerOpacity] = useState(pmtilesOpacity);
  const layerOpacityRef = useRef(layerOpacity);

  useEffect(() => {
    setLayerOpacity(pmtilesOpacity);
  }, [pmtilesOpacity]);

  useEffect(() => {
    layerOpacityRef.current = layerOpacity;
  }, [layerOpacity]);

  const [selectedBasemap, setSelectedBasemap] = useState(BASEMAP.BC_GOV);
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [areLayersLoaded, setAreLayersLoaded] = useState(false);
  const [styleReadyTick, setStyleReadyTick] = useState(0);
  const addedLayerIdsRef = useRef<Set<string>>(new Set());
  const addedSourceIdsRef = useRef<Set<string>>(new Set());
  const sourceUrlBySourceIdRef = useRef<globalThis.Map<string, string>>(new globalThis.Map());
  const boundsCacheRef = useRef<globalThis.Map<string, maplibregl.LngLatBounds>>(new globalThis.Map());
  const lastFitKeyRef = useRef<string | null>(null);
  const normalizedPmtilesUrls = useMemo(() => {
    return pmtilesUrls.filter((url) => {
      return Boolean(url);
    });
  }, [pmtilesUrls]);
  const fitKey = useMemo(() => {
    const baseKey = normalizedPmtilesUrls.map((url) => getStableTilesetUrlKey(url)).join('|');
    if (boundsRefreshKey === undefined || boundsRefreshKey === null) {
      return baseKey;
    }

    return `${baseKey}::${boundsRefreshKey}`;
  }, [boundsRefreshKey, normalizedPmtilesUrls]);
  const explicitFitKey = useMemo(() => {
    if (!fitBounds) {
      return null;
    }

    return `${fitBounds[0][0]},${fitBounds[0][1]},${fitBounds[1][0]},${fitBounds[1][1]}::${boundsRefreshKey ?? ''}`;
  }, [boundsRefreshKey, fitBounds]);
  const hasPmtiles = normalizedPmtilesUrls.length > 0;
  const hasRenderedPmtiles = hasAnyPmtilesLayers(mapRef.current, PMTILES_LAYER_PREFIX);
  const basemapStyle = useMemo(() => {
    return createBasemapStyle(
      config.BASEMAP_URL,
      config.BASEMAP_ATTRIBUTION,
      config.SATELLITE_BASEMAP_URL,
      config.SATELLITE_BASEMAP_ATTRIBUTION
    );
  }, [
    config.BASEMAP_ATTRIBUTION,
    config.BASEMAP_URL,
    config.SATELLITE_BASEMAP_URL,
    config.SATELLITE_BASEMAP_ATTRIBUTION,
  ]);

  const isMapLoading = !isMapInitialized || (waitForPmtiles && hasPmtiles && !areLayersLoaded && !hasRenderedPmtiles);

  useEffect(() => {
    if (!onPmtilesDisplayed) {
      return;
    }

    onPmtilesDisplayed(hasPmtiles && (areLayersLoaded || hasRenderedPmtiles));
  }, [areLayersLoaded, hasPmtiles, hasRenderedPmtiles, onPmtilesDisplayed]);

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
        hydratePmtilesTrackingFromStyle(
          cached.map,
          PmtilesSourcePrefix,
          PMTILES_LAYER_PREFIX,
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
      style: basemapStyle,
      center: HAIDA_GWAII_INITIAL_CENTER,
      zoom: HAIDA_GWAII_INITIAL_ZOOM,
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
    } else {
      map.once('load', handleMapReady);
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
  }, [
    basemapStyle,
    interactive,
    keepAliveKey,
    mapRef,
    setIsMapReady,
    showBaseLayer,
    showNavigationControl,
    useSharedContext,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapInitialized) {
      return;
    }

    ensureBaseLayer(map, showBaseLayer, selectedBasemap);
  }, [isMapInitialized, mapRef, selectedBasemap, showBaseLayer]);

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
    lastFitKeyRef.current = null;
  }, [fitKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapInitialized || !map.isStyleLoaded() || !fitBounds || !explicitFitKey) {
      return;
    }

    if (lastFitKeyRef.current === explicitFitKey) {
      return;
    }

    lastFitKeyRef.current = explicitFitKey;
    fitMapToBounds(map, fitBounds, DefaultFitBoundsPadding, DefaultFitBoundsMaxZoom);
  }, [explicitFitKey, fitBounds, isMapInitialized, mapRef, styleReadyTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
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
          layerOpacityRef.current,
          PmtilesSourcePrefix,
          PMTILES_LAYER_PREFIX,
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
  }, [isMapInitialized, mapRef, normalizedPmtilesUrls, styleReadyTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapInitialized) {
      return;
    }

    for (const layerId of addedLayerIdsRef.current) {
      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, 'raster-opacity', layerOpacity);
      }
    }
  }, [isMapInitialized, layerOpacity, mapRef, normalizedPmtilesUrls, styleReadyTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapInitialized || !areLayersLoaded || !map.isStyleLoaded()) {
      return;
    }

    if (!normalizedPmtilesUrls.length || fitBounds) {
      return;
    }

    if (lastFitKeyRef.current === fitKey) {
      return;
    }

    let isCancelled = false;

    const normalizeBoundsValues = (
      minLonValue: number,
      minLatValue: number,
      maxLonValue: number,
      maxLatValue: number
    ): [number, number, number, number] => {
      const scale = Math.max(Math.abs(minLonValue), Math.abs(maxLonValue)) > 180 ? 1e7 : 1;
      return [minLonValue / scale, minLatValue / scale, maxLonValue / scale, maxLatValue / scale];
    };

    const getBoundsFromMetadata = (metadata: Record<string, unknown>): maplibregl.LngLatBounds | null => {
      const boundsValue = metadata.bounds ?? metadata['bounds'];
      if (!boundsValue) {
        return null;
      }

      if (Array.isArray(boundsValue)) {
        const [minLon, minLat, maxLon, maxLat] = boundsValue.map((value) => Number(value));
        if ([minLon, minLat, maxLon, maxLat].some((value) => Number.isNaN(value))) {
          return null;
        }

        const [normalizedMinLon, normalizedMinLat, normalizedMaxLon, normalizedMaxLat] = normalizeBoundsValues(
          minLon,
          minLat,
          maxLon,
          maxLat
        );
        return new maplibregl.LngLatBounds([normalizedMinLon, normalizedMinLat], [normalizedMaxLon, normalizedMaxLat]);
      }

      if (typeof boundsValue === 'string') {
        const parts = boundsValue.split(',').map((value) => Number(value));
        if (parts.length !== 4 || parts.some((value) => Number.isNaN(value))) {
          return null;
        }

        const [normalizedMinLon, normalizedMinLat, normalizedMaxLon, normalizedMaxLat] = normalizeBoundsValues(
          parts[0],
          parts[1],
          parts[2],
          parts[3]
        );
        return new maplibregl.LngLatBounds([normalizedMinLon, normalizedMinLat], [normalizedMaxLon, normalizedMaxLat]);
      }

      return null;
    };

    const getBoundsFromHeader = (header: Record<string, unknown>): maplibregl.LngLatBounds | null => {
      const minLonRaw = header.minLon ?? header.min_lon ?? header.minlon;
      const minLatRaw = header.minLat ?? header.min_lat ?? header.minlat;
      const maxLonRaw = header.maxLon ?? header.max_lon ?? header.maxlon;
      const maxLatRaw = header.maxLat ?? header.max_lat ?? header.maxlat;
      const minLon = typeof minLonRaw === 'number' ? minLonRaw : Number(minLonRaw);
      const minLat = typeof minLatRaw === 'number' ? minLatRaw : Number(minLatRaw);
      const maxLon = typeof maxLonRaw === 'number' ? maxLonRaw : Number(maxLonRaw);
      const maxLat = typeof maxLatRaw === 'number' ? maxLatRaw : Number(maxLatRaw);
      if ([minLon, minLat, maxLon, maxLat].some((value) => Number.isNaN(value))) {
        return null;
      }

      const [normalizedMinLon, normalizedMinLat, normalizedMaxLon, normalizedMaxLat] = normalizeBoundsValues(
        minLon,
        minLat,
        maxLon,
        maxLat
      );
      return new maplibregl.LngLatBounds([normalizedMinLon, normalizedMinLat], [normalizedMaxLon, normalizedMaxLat]);
    };

    const getBoundsSpanScore = (bounds: maplibregl.LngLatBounds): number => {
      const longitudeSpan = Math.abs(bounds.getEast() - bounds.getWest());
      const latitudeSpan = Math.abs(bounds.getNorth() - bounds.getSouth());
      return longitudeSpan + latitudeSpan;
    };

    const fitPmtilesBounds = async () => {
      const bounds = new maplibregl.LngLatBounds();

      for (const url of normalizedPmtilesUrls) {
        if (isCancelled) {
          return;
        }

        const stableKey = getStableTilesetUrlKey(url);
        const cachedBounds = boundsCacheRef.current.get(stableKey);
        if (cachedBounds) {
          bounds.extend(cachedBounds);
          continue;
        }

        try {
          const pmtiles = new PMTiles(url);
          const metadata = (await pmtiles.getMetadata()) as Record<string, unknown>;
          const metadataBounds = getBoundsFromMetadata(metadata);
          const header = (await pmtiles.getHeader()) as unknown as Record<string, unknown>;
          const headerBounds = getBoundsFromHeader(header);

          let chosenBounds: maplibregl.LngLatBounds | null = null;
          if (metadataBounds && headerBounds) {
            chosenBounds =
              getBoundsSpanScore(headerBounds) <= getBoundsSpanScore(metadataBounds) ? headerBounds : metadataBounds;
          } else if (headerBounds) {
            chosenBounds = headerBounds;
          } else if (metadataBounds) {
            chosenBounds = metadataBounds;
          }

          if (chosenBounds && !chosenBounds.isEmpty()) {
            boundsCacheRef.current.set(stableKey, chosenBounds);
            bounds.extend(chosenBounds);
          }
        } catch {
          // Ignore PMTiles metadata failures and continue with available bounds.
        }
      }

      if (isCancelled || bounds.isEmpty()) {
        return;
      }

      lastFitKeyRef.current = fitKey;
      fitMapToBounds(map, bounds, DefaultFitBoundsPadding, DefaultFitBoundsMaxZoom);
    };

    void fitPmtilesBounds();

    return () => {
      isCancelled = true;
    };
  }, [areLayersLoaded, fitBounds, fitKey, isMapInitialized, mapRef, normalizedPmtilesUrls, styleReadyTick]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <Box ref={mapHostRef} sx={{ position: 'absolute', inset: 0 }} />
      {interactive && showBaseLayer && config.SATELLITE_BASEMAP_URL ? (
        <BasemapControl value={selectedBasemap} onChange={setSelectedBasemap} right={showNavigationControl ? 50 : 10} />
      ) : null}
      {showPmtilesLegend && hasPmtiles ? (
        <PmtilesLegend
          pmtilesUrls={normalizedPmtilesUrls}
          taskType={pmtilesLegendTaskType}
          opacity={layerOpacity}
          onOpacityChange={setLayerOpacity}
        />
      ) : null}
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
 * Replace PMTiles layers with the provided list of archive URLs.
 *
 * @param {maplibregl.Map} map MapLibre map instance to update.
 * @param {string[]} pmtilesUrls PMTiles archive URLs to display.
 * @param {number} pmtilesOpacity Opacity applied to the analysis raster layers.
 * @param {string} sourcePrefix Prefix used to identify managed map sources.
 * @param {string} layerPrefix Prefix used to identify managed map layers.
 * @param {Set<string>} trackedLayerIds Mutable set tracking managed layer identifiers.
 * @param {Set<string>} trackedSourceIds Mutable set tracking managed source identifiers.
 * @param {globalThis.Map<string, string>} sourceUrlBySourceId Mutable mapping from source identifiers to their archive URLs.
 * @returns {Promise<void>} Resolves when the operation completes.
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
 * @param {maplibregl.Map} map MapLibre map instance to update.
 * @param {Set<string>} desiredLayerIds Layer identifiers that should remain on the map.
 * @param {Set<string>} desiredSourceIds Source identifiers that should remain on the map.
 * @param {Set<string>} trackedLayerIds Mutable set tracking managed layer identifiers.
 * @param {Set<string>} trackedSourceIds Mutable set tracking managed source identifiers.
 * @param {Map<string, string>} sourceUrlBySourceId Mutable mapping from source identifiers to their archive URLs.
 * @returns {void} No return value.
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
 * @param {maplibregl.Map | null} map MapLibre map instance to update.
 * @param {string} layerPrefix Prefix used to identify managed map layers.
 * @returns {boolean} Has any pmtiles layers.
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
 * Fits a MapLibre map to bounds, handling single-coordinate bounds as a centered point.
 *
 * @param {maplibregl.Map} map Map instance to move.
 * @param {maplibregl.LngLatBoundsLike} bounds Bounds in longitude/latitude order.
 * @param {number} padding Padding in screen pixels.
 * @param {number} maxZoom Maximum zoom after fitting.
 * @returns {void} No return value.
 */
const fitMapToBounds = (
  map: maplibregl.Map,
  bounds: maplibregl.LngLatBoundsLike,
  padding: number,
  maxZoom: number
): void => {
  const lngLatBounds = maplibregl.LngLatBounds.convert(bounds);
  if (lngLatBounds.getWest() === lngLatBounds.getEast() && lngLatBounds.getSouth() === lngLatBounds.getNorth()) {
    map.setCenter(lngLatBounds.getCenter());
    map.setZoom(maxZoom);
    return;
  }

  map.fitBounds(lngLatBounds, {
    padding,
    duration: 0,
    maxZoom,
  });
};

/**
 * Normalizes PMTiles URLs for stable source/layer identity.
 *
 * @param {string} tilesetUrl PMTiles archive URL whose stable key is needed.
 * @returns {string} Stable tileset url key.
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
 * @param {string} url URL of the resource.
 * @returns {string} Pmtiles source url.
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
 * @param {string} value Value to normalize or inspect.
 * @returns {string} To map identifier.
 */
const toMapIdentifier = (value: string): string => {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
};

/**
 * Rehydrates tracked PMTiles source/layer IDs from the active map style.
 *
 * @param {maplibregl.Map} map MapLibre map instance to update.
 * @param {string} sourcePrefix Prefix used to identify managed map sources.
 * @param {string} layerPrefix Prefix used to identify managed map layers.
 * @param {Set<string>} trackedSourceIds Mutable set tracking managed source identifiers.
 * @param {Set<string>} trackedLayerIds Mutable set tracking managed layer identifiers.
 * @param {Map<string, string>} sourceUrlBySourceId Mutable mapping from source identifiers to their archive URLs.
 * @returns {void} No return value.
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
