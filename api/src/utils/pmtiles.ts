import { getS3HostUrl } from './file-utils';
import { getPresignedObjectUrl, parseUri } from './object-store';

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

/**
 * Converts a stored tileset URI into a PMTiles URL using a presigned object URL when needed.
 *
 * @param {string | null | undefined} uri
 * @return {*}  {Promise<string | null>}
 */
export const toPresignedPmtilesUrl = async (uri: string | null | undefined): Promise<string | null> => {
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
    const { bucket, key } = parseUri(uri);
    const signedUrl = await getPresignedObjectUrl(bucket, key);

    if (!signedUrl) {
      return null;
    }

    return `pmtiles://${signedUrl}`;
  }

  return null;
};
