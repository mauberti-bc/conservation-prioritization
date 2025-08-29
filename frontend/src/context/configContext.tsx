import axios from 'axios';
import { createContext, useEffect, useState } from 'react';
import { ensureProtocol } from 'utils/util';

export interface IConfig {
  API_HOST: string;
  PREFECT_API_HOST: string;
  NODE_ENV: string;
  VITE_APP_NODE_ENV: string;
  S3_PUBLIC_HOST_URL: string;
  ZARR_STORE_PATH: string;
}

export const ConfigContext = createContext<IConfig | undefined>(undefined);

/**
 * Return the app config based on locally set environment variables.
 *
 * This is used when running the app locally in docker.
 *
 * Note: All changes to env vars here must also be reflected in the `app/server/index.js` file, so that the app has
 * access to the same env vars when running in both local development (via compose.yml) and in OpenShift.
 *
 * @return {*}  {IConfig}
 */
const getLocalConfig = (): IConfig => {
  const API_HOST = import.meta.env.VITE_APP_API_HOST;
  const API_PORT = import.meta.env.VITE_APP_API_PORT;
  const PREFECT_API_URL = import.meta.env.VITE_PREFECT_API_URL;

  const API_URL = (API_PORT && `${API_HOST}:${API_PORT}`) || API_HOST || 'localhost';

  const OBJECT_STORE_URL = import.meta.env.OBJECT_STORE_URL || 'nrs.objectstore.gov.bc.ca';
  const OBJECT_STORE_BUCKET_NAME = import.meta.env.OBJECT_STORE_BUCKET_NAME || 'gblhvt';

  return {
    API_HOST: ensureProtocol(API_URL, 'http://'),
    PREFECT_API_HOST: ensureProtocol(PREFECT_API_URL, 'http://'),
    NODE_ENV: import.meta.env.MODE,
    VITE_APP_NODE_ENV: import.meta.env.VITE_APP_NODE_ENV || 'dev',
    S3_PUBLIC_HOST_URL: ensureProtocol(`${OBJECT_STORE_URL}/${OBJECT_STORE_BUCKET_NAME}`, 'https://'),
    ZARR_STORE_PATH: import.meta.env.VITE_ZARR_STORE_PATH,
  };
};

/**
 * Return the app config based on a deployed app, running via `app/server/index.js`
 *
 * @return {*}  {Promise<IConfig>}
 */
const getDeployedConfig = async (): Promise<IConfig> => {
  const { data } = await axios.get<IConfig>('/config');

  return data;
};

/**
 * Return true if MODE=development, false otherwise.
 *
 * @return {*}  {boolean}
 */
const isDevelopment = (): boolean => {
  if (import.meta.env.MODE === 'development') {
    return true;
  }

  return false;
};

/**
 * Provides environment variables.
 *
 * This will fetch env vars from either `import.meta.env` if running with MODE=development, or from
 * `app/server/index.js` if running as a deployed MODE=production build.
 *
 * @param {*} props
 * @return {*}
 */
export const ConfigContextProvider: React.FC<React.PropsWithChildren> = (props) => {
  const [config, setConfig] = useState<IConfig>();

  useEffect(() => {
    const loadConfig = async () => {
      if (isDevelopment()) {
        const localConfig = getLocalConfig();
        setConfig(localConfig);
      } else {
        const deployedConfig = await getDeployedConfig();
        setConfig(deployedConfig);
      }
    };

    if (!config) {
      loadConfig();
    }
  }, [config]);
  return <ConfigContext.Provider value={config}>{props.children}</ConfigContext.Provider>;
};
