import { LayerOption } from 'features/home/control-panel/form/ControlPanelForm';
import { useConservationApi } from 'hooks/useConservationApi';
import useIsMounted from 'hooks/useIsMounted';
import { createContext, PropsWithChildren, useCallback, useMemo, useRef, useState } from 'react';

export interface ILayerContext {
  /**
   * Returns cached layer data if available.
   * If not cached and not already requested, dispatches a fetch and returns null.
   */
  getCachedLayerByPath: (path: string) => LayerOption | null;

  /**
   * Always resolves layer data.
   * Returns cached value, pending promise, or dispatches a request.
   */
  getCachedLayerByPathAsync: (path: string) => Promise<LayerOption | null>;

  /**
   * Fetches and caches layers for the given search terms.
   */
  cacheLayersBySearchTerms: (terms: string[]) => Promise<LayerOption[] | null>;
}

export const LayerContext = createContext<ILayerContext | undefined>(undefined);

export const LayerContextProvider = ({ children }: PropsWithChildren) => {
  const conservationApi = useConservationApi();
  const isMounted = useIsMounted();

  /**
   * path → LayerOption | null
   */
  const [layerCache, setLayerCache] = useState<Record<string, LayerOption | null>>({});

  /**
   * path → in-flight promise
   */
  const dispatchedLayerPromises = useRef<Record<string, Promise<LayerOption | null>>>({});

  /**
   * Fetch layers by search terms and cache them.
   */
  const cacheLayersBySearchTerms = useCallback(
    async (terms: string[]) => {
      const fetchPromise = Promise.all(terms.map((term) => conservationApi.layer.findLayers(term)))
        .then((responses) => {
          if (!isMounted()) {
            return null;
          }

          const layers = responses.flatMap((r) => r.layers);

          if (layers.length === 0) {
            return [];
          }

          setLayerCache((prev) => {
            const next = { ...prev };
            for (const layer of layers) {
              next[layer.path] = layer;
            }
            return next;
          });

          return layers;
        })
        .catch(() => null);

      for (const term of terms) {
        dispatchedLayerPromises.current[term] = fetchPromise
          .then((layers) => {
            if (!layers) {
              return null;
            }
            return layers.find((layer) => layer.path.includes(term)) ?? null;
          })
          .catch(() => null);
      }

      return fetchPromise;
    },
    [conservationApi.layer, isMounted]
  );

  /**
   * Sync accessor — returns cached layer or triggers fetch.
   */
  const getCachedLayerByPath = useCallback(
    (path: string): LayerOption | null => {
      if (Object.prototype.hasOwnProperty.call(layerCache, path)) {
        return layerCache[path] ?? null;
      }

      if (dispatchedLayerPromises.current[path]) {
        return null;
      }

      cacheLayersBySearchTerms([path]);
      return null;
    },
    [layerCache, cacheLayersBySearchTerms]
  );

  /**
   * Async accessor — always resolves layer data.
   */
  const getCachedLayerByPathAsync = useCallback(
    async (path: string): Promise<LayerOption | null> => {
      if (dispatchedLayerPromises.current[path]) {
        return dispatchedLayerPromises.current[path];
      }

      await cacheLayersBySearchTerms([path]);

      return dispatchedLayerPromises.current[path] ?? null;
    },
    [cacheLayersBySearchTerms]
  );

  const contextValue: ILayerContext = useMemo(
    () => ({
      getCachedLayerByPath,
      getCachedLayerByPathAsync,
      cacheLayersBySearchTerms,
    }),
    [getCachedLayerByPath, getCachedLayerByPathAsync, cacheLayersBySearchTerms]
  );

  return <LayerContext.Provider value={contextValue}>{children}</LayerContext.Provider>;
};
