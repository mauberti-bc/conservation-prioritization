import { getS3HostUrl } from './file-utils';

/**
 * Converts a stored tileset URI into a PMTiles URL usable by clients.
 *
 * @param {string | null | undefined} uri
 * @return {*}  {string | null}
 */
export const toPmtilesUrl = (uri: string | null | undefined): string | null => {
  if (!uri) {
    return null;
  }

  if (uri.startsWith('pmtiles://')) {
    return uri;
  }

  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return `pmtiles://${uri}`;
  }

  if (uri.startsWith('s3://')) {
    const withoutScheme = uri.slice('s3://'.length);
    const [, ...keyParts] = withoutScheme.split('/');
    const key = keyParts.join('/');

    if (!key) {
      return null;
    }

    const hostUrl = getS3HostUrl(key);
    return `pmtiles://${hostUrl}`;
  }

  return null;
};
