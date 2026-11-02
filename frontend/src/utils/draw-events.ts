import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { Map } from 'maplibre-gl';
import { DrawEventListener, StringKeyedEventTarget } from './draw-events.interface';

/**
 * Subscribes to a MapboxDraw event on a MapLibre map.
 *
 * MapboxDraw fires its events (such as `draw.render`) through the map it is
 * attached to, but MapLibre 6 only types its own built-in event names. This
 * keeps the listener strongly typed using MapboxDraw's event map.
 *
 * @param {Map} map MapLibre map the draw control is attached to.
 * @param {T} type MapboxDraw event name to listen for.
 * @param {DrawEventListener<T>} listener Callback invoked with the draw event.
 * @returns {void} No return value.
 */
export function addDrawEventListener<T extends MapboxDraw.DrawEventType>(
  map: Map,
  type: T,
  listener: DrawEventListener<T>
): void {
  (map as unknown as StringKeyedEventTarget).on(type, listener as (event: unknown) => void);
}

/**
 * Unsubscribes a listener previously added with `addDrawEventListener`.
 *
 * @param {Map} map MapLibre map the listener was attached to.
 * @param {T} type MapboxDraw event name the listener was registered for.
 * @param {DrawEventListener<T>} listener The same callback reference passed when subscribing.
 * @returns {void} No return value.
 */
export function removeDrawEventListener<T extends MapboxDraw.DrawEventType>(
  map: Map,
  type: T,
  listener: DrawEventListener<T>
): void {
  (map as unknown as StringKeyedEventTarget).off(type, listener as (event: unknown) => void);
}
