import MapboxDraw from '@mapbox/mapbox-gl-draw';

/**
 * Listener for a MapboxDraw event fired on a MapLibre map.
 *
 * @template T The MapboxDraw event name, for example `draw.render`.
 */
export type DrawEventListener<T extends MapboxDraw.DrawEventType> = (event: MapboxDraw.DrawEvents[T]) => void;

/**
 * Minimal string-keyed event target used to attach MapboxDraw events.
 *
 * MapLibre 6 types `Map.on`/`Map.off` against a closed set of built-in event
 * names, so custom events fired by MapboxDraw need this looser signature.
 */
export interface StringKeyedEventTarget {
  on(type: string, listener: (event: unknown) => void): unknown;
  off(type: string, listener: (event: unknown) => void): unknown;
}
