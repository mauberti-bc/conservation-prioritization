import { BASEMAP } from 'constants/basemap';

export interface BasemapControlProps {
  value: BASEMAP;
  onChange: (basemap: BASEMAP) => void;
  right: number;
}
