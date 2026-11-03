import { BASEMAP } from 'constants/basemap';
import { Map, RasterSourceSpecification } from 'maplibre-gl';
import { describe, expect, it, vi } from 'vitest';
import { createBasemapStyle, ensureBaseLayer } from './basemap';

describe('basemap switching', () => {
  it('starts with the BC map and includes attributed satellite imagery', () => {
    const style = createBasemapStyle(
      'https://roads.example.com/{z}/{y}/{x}',
      'Roads attribution',
      'https://example.com/{z}/{y}/{x}',
      'Imagery attribution'
    );

    expect((style.sources.basemap as RasterSourceSpecification).tiles).toEqual([
      'https://roads.example.com/{z}/{y}/{x}',
    ]);
    expect((style.sources['satellite-basemap'] as RasterSourceSpecification).tiles).toEqual([
      'https://example.com/{z}/{y}/{x}',
    ]);
    expect((style.sources['satellite-basemap'] as RasterSourceSpecification).attribution).toBe('Imagery attribution');
    expect(style.layers.find((layer) => layer.id === 'satellite-basemap')?.layout?.visibility).toBe('none');
  });

  it('preserves the configured BC tile service', () => {
    const style = createBasemapStyle('https://example.com/{z}/{x}/{y}', 'Custom attribution', '', '');

    expect(style.layers).toHaveLength(1);
    expect(style.sources['satellite-basemap']).toBeUndefined();
    expect(style.sources.basemap).toMatchObject({
      tiles: ['https://example.com/{z}/{x}/{y}'],
      attribution: 'Custom attribution',
    });
  });

  it('switches in both directions and hides both basemaps when requested without touching overlays', () => {
    const visibility = new globalThis.Map([
      ['basemap', 'visible'],
      ['satellite-basemap', 'none'],
      ['analysis-result', 'visible'],
      ['drawn-area', 'visible'],
    ]);
    const map = {
      getLayer: (id: string) => visibility.has(id),
      setLayoutProperty: (id: string, _property: string, value: string) => visibility.set(id, value),
    } as unknown as Map;

    ensureBaseLayer(map, true, BASEMAP.SATELLITE);
    expect(visibility.get('basemap')).toBe('none');
    expect(visibility.get('satellite-basemap')).toBe('visible');

    ensureBaseLayer(map, true, BASEMAP.BC_GOV);
    expect(visibility.get('basemap')).toBe('visible');
    expect(visibility.get('satellite-basemap')).toBe('none');

    ensureBaseLayer(map, false, BASEMAP.SATELLITE);
    expect(visibility.get('basemap')).toBe('none');
    expect(visibility.get('satellite-basemap')).toBe('none');
    expect(visibility.get('analysis-result')).toBe('visible');
    expect(visibility.get('drawn-area')).toBe('visible');
  });

  it('ignores unavailable layers while a style is loading', () => {
    const setLayoutProperty = vi.fn();
    const map = { getLayer: () => undefined, setLayoutProperty } as unknown as Map;

    ensureBaseLayer(map, true, BASEMAP.SATELLITE);

    expect(setLayoutProperty).not.toHaveBeenCalled();
  });
});
