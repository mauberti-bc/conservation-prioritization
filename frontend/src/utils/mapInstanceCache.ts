import maplibregl from 'maplibre-gl';

export interface MapCacheEntry {
  map: maplibregl.Map;
  container: HTMLDivElement;
}

const mapCache = new Map<string, MapCacheEntry>();

export const getMapCacheEntry = (key: string): MapCacheEntry | undefined => {
  return mapCache.get(key);
};

export const setMapCacheEntry = (key: string, entry: MapCacheEntry): void => {
  mapCache.set(key, entry);
};

export const attachMapContainer = (entry: MapCacheEntry, host: HTMLElement): void => {
  host.innerHTML = '';
  host.appendChild(entry.container);
};

export const detachMapContainer = (entry: MapCacheEntry): void => {
  if (entry.container.parentElement) {
    entry.container.parentElement.removeChild(entry.container);
  }
};
