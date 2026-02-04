import maplibregl from 'maplibre-gl';
import * as pmtiles from 'pmtiles';

let protocol: pmtiles.Protocol | null = null;

export const ensurePMTilesProtocol = (): void => {
  if (protocol) {
    return;
  }

  protocol = new pmtiles.Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
};
