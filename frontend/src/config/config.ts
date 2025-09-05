import { ensureProtocol } from 'utils/util';

export interface IConfig {
  API_HOST: string;
  PREFECT_API_HOST: string;
  NODE_ENV: string;
  VITE_APP_NODE_ENV: string;
  S3_PUBLIC_HOST_URL: string;
  ZARR_STORE_PATH: string;
}

const requiredEnvVars = [
  'VITE_APP_API_HOST',
  'VITE_PREFECT_API_URL',
  'VITE_OBJECT_STORE_URL',
  'VITE_OBJECT_STORE_BUCKET_NAME',
  'VITE_ZARR_STORE_PATH',
];

for (const varName of requiredEnvVars) {
  if (!import.meta.env[varName]) {
    throw new Error(`Environment variable ${varName} is required but not defined.`);
  }
}

const VITE_APP_API_HOST = import.meta.env.VITE_APP_API_HOST;
const VITE_APP_API_PORT = import.meta.env.VITE_APP_API_PORT || '';
const VITE_PREFECT_API_URL = import.meta.env.VITE_PREFECT_API_URL;
const VITE_ZARR_STORE_PATH = import.meta.env.VITE_ZARR_STORE_PATH;

const OBJECT_STORE_URL = import.meta.env.VITE_OBJECT_STORE_URL;
const OBJECT_STORE_BUCKET_NAME = import.meta.env.VITE_OBJECT_STORE_BUCKET_NAME;

const API_URL = VITE_APP_API_HOST
  ? VITE_APP_API_PORT
    ? `${VITE_APP_API_HOST}:${VITE_APP_API_PORT}`
    : VITE_APP_API_HOST
  : (() => {
      throw new Error('VITE_APP_API_HOST is required.');
    })();

const config: IConfig = {
  API_HOST: ensureProtocol(API_URL, 'http://'),
  PREFECT_API_HOST: ensureProtocol(VITE_PREFECT_API_URL, 'http://'),
  NODE_ENV: import.meta.env.NODE_ENV || 'development',
  VITE_APP_NODE_ENV: import.meta.env.VITE_APP_NODE_ENV || 'dev',
  S3_PUBLIC_HOST_URL: ensureProtocol(`${OBJECT_STORE_URL}/${OBJECT_STORE_BUCKET_NAME}`, 'https://'),
  ZARR_STORE_PATH: VITE_ZARR_STORE_PATH,
};

export default config;
