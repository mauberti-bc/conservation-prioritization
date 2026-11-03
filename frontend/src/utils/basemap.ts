import { BASEMAP } from 'constants/basemap';
import { Map, StyleSpecification } from 'maplibre-gl';

const BASEMAP_LAYER_ID = 'basemap';
const SATELLITE_LAYER_ID = 'satellite-basemap';

/**
 * Creates configured raster basemaps, with the BC government map visible initially.
 *
 * @param {string} basemapUrl Tile URL template for the BC government basemap.
 * @param {string} attribution Attribution displayed for the BC government basemap.
 * @param {string} satelliteUrl Satellite tile URL template; an empty value disables satellite imagery.
 * @param {string} satelliteAttribution Attribution displayed for satellite imagery.
 * @returns {StyleSpecification} MapLibre style containing the configured raster sources and layers.
 */
export function createBasemapStyle(
  basemapUrl: string,
  attribution: string,
  satelliteUrl: string,
  satelliteAttribution: string
): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    sources: {
      [BASEMAP_LAYER_ID]: {
        type: 'raster',
        tiles: basemapUrl ? [basemapUrl] : [],
        tileSize: 256,
        attribution,
      },
    },
    layers: [{ id: BASEMAP_LAYER_ID, type: 'raster', source: BASEMAP_LAYER_ID }],
  };

  if (satelliteUrl) {
    style.sources[SATELLITE_LAYER_ID] = {
      type: 'raster',
      tiles: [satelliteUrl],
      tileSize: 256,
      attribution: satelliteAttribution,
    };
    style.layers.push({
      id: SATELLITE_LAYER_ID,
      type: 'raster',
      source: SATELLITE_LAYER_ID,
      layout: { visibility: 'none' },
    });
  }
  return style;
}

/**
 * Changes basemap visibility without replacing the style, overlays, or camera position.
 *
 * @param {Map} map MapLibre map instance to update.
 * @param {boolean} showBaseLayer Whether the selected basemap should be visible.
 * @param basemap Basemap selected by the user.
 * @returns {void} No return value.
 */
export function ensureBaseLayer(map: Map, showBaseLayer: boolean, basemap = BASEMAP.BC_GOV): void {
  for (const [layerId, selection] of [
    [BASEMAP_LAYER_ID, BASEMAP.BC_GOV],
    [SATELLITE_LAYER_ID, BASEMAP.SATELLITE],
  ]) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', showBaseLayer && basemap === selection ? 'visible' : 'none');
    }
  }
}
