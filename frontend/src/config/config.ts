import { ensureProtocol } from 'utils/util';

export interface IConfig {
  NODE_ENV: string;
  NODE_OPTIONS: string;
  PREFECT_API_HOST: string;
  ZARR_STORE_PATH: string;
}

const VITE_NODE_ENV = import.meta.env.VITE_NODE_ENV;
const VITE_NODE_OPTIONS = import.meta.env.VITE_NODE_OPTIONS;
const VITE_PREFECT_API_URL = import.meta.env.VITE_PREFECT_API_URL;
const VITE_ZARR_STORE_PATH = import.meta.env.VITE_ZARR_STORE_PATH;

const config: IConfig = {
  NODE_ENV: VITE_NODE_ENV,
  NODE_OPTIONS: VITE_NODE_OPTIONS,
  PREFECT_API_HOST: ensureProtocol(VITE_PREFECT_API_URL, 'http://'),
  ZARR_STORE_PATH: VITE_ZARR_STORE_PATH,
};

export default config;
