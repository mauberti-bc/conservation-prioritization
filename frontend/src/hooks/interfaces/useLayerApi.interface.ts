import { ApiPaginationResponseParams } from 'types/pagination';

type LayerMeta = {
  group: string; // e.g. 'landcover/disturbance'
  path: string; // e.g. 'landcover/disturbance/mining'
  name: string; // Display name (from zattrs.label)
  description?: string;
  shape: number[];
  dtype: string;
};

export interface FindLayersResponse {
  layers: LayerMeta[];
  pagination: ApiPaginationResponseParams;
}
