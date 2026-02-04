import {
  GetObjectCommand,
  GetObjectCommandOutput,
  HeadObjectCommand,
  HeadObjectCommandOutput,
  PutObjectCommand,
  PutObjectCommandOutput,
  S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

export interface ObjectStoreConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  prefix: string;
  forcePathStyle: boolean;
}

/**
 * Returns the configured object store settings.
 */
export const getObjectStoreConfig = (): ObjectStoreConfig => {
  const endpoint = process.env.OBJECT_STORE_ENDPOINT;
  const region = process.env.OBJECT_STORE_REGION || 'us-east-1';
  const accessKeyId = process.env.OBJECT_STORE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.OBJECT_STORE_SECRET_KEY_ID;
  const bucket = process.env.OBJECT_STORE_BUCKET_NAME || '';
  const prefix = (process.env.OBJECT_STORE_PREFIX || '').replace(/^\/+|\/+$/g, '');
  const forcePathStyle = String(process.env.OBJECT_STORE_FORCE_PATH_STYLE || '').toLowerCase() === 'true';

  if (!endpoint) {
    throw new Error('OBJECT_STORE_ENDPOINT is not configured.');
  }
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Object store credentials are not configured.');
  }
  if (!bucket) {
    throw new Error('OBJECT_STORE_BUCKET_NAME is not configured.');
  }

  return {
    endpoint: normalizeEndpoint(endpoint),
    region,
    accessKeyId,
    secretAccessKey,
    bucket,
    prefix,
    forcePathStyle
  };
};

/**
 * Returns the public endpoint used by clients (e.g. localhost for MinIO in dev).
 */
export const getObjectStorePublicEndpoint = (): string | null => {
  const endpoint = process.env.OBJECT_STORE_PUBLIC_ENDPOINT;

  if (!endpoint) {
    return null;
  }

  return normalizeEndpoint(endpoint);
};

/**
 * Build an S3 client for the configured object store.
 */
export const getObjectStoreClient = (): S3Client => {
  const config = getObjectStoreConfig();
  return new S3Client({
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    },
    forcePathStyle: config.forcePathStyle,
    region: config.region
  });
};

/**
 * Build an object key with an optional prefix.
 */
export const buildObjectKey = (key: string): string => {
  const { prefix } = getObjectStoreConfig();
  if (!prefix) {
    return key.replace(/^\/+/, '');
  }
  return `${prefix}/${key.replace(/^\/+/, '')}`;
};

/**
 * Build an S3 URI from a bucket and key.
 */
export const makeUri = (bucket: string, key: string): string => {
  return `s3://${bucket}/${key}`;
};

/**
 * Parse an S3 URI into bucket and key components.
 */
export const parseUri = (uri: string): { bucket: string; key: string } => {
  if (!uri.startsWith('s3://')) {
    throw new Error(`Unsupported object store URI: ${uri}`);
  }

  const withoutScheme = uri.slice('s3://'.length);
  const parts = withoutScheme.split('/');

  if (parts.length < 2 || !parts[0]) {
    throw new Error(`Invalid object store URI: ${uri}`);
  }

  return {
    bucket: parts[0],
    key: parts.slice(1).join('/')
  };
};

/**
 * Generate a presigned GET URL for an object in the configured object store.
 *
 * @param {string} bucket
 * @param {string} key
 * @param {number} [expiresInSeconds]
 * @return {*}  {Promise<string | null>}
 */
export const getPresignedObjectUrl = async (
  bucket: string,
  key: string,
  expiresInSeconds = 300
): Promise<string | null> => {
  if (!bucket || !key) {
    return null;
  }

  const client = getObjectStoreClient();

  const signedUrl = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key
    }),
    {
      expiresIn: expiresInSeconds
    }
  );

  return rewriteSignedUrlForPublicEndpoint(signedUrl);
};

/**
 * Rewrites a signed URL to use a public endpoint when configured.
 *
 * @param {string} signedUrl
 * @return {*}  {string}
 */
const rewriteSignedUrlForPublicEndpoint = (signedUrl: string): string => {
  const publicEndpoint = getObjectStorePublicEndpoint();

  if (!publicEndpoint) {
    return signedUrl;
  }

  try {
    const signed = new URL(signedUrl);
    const publicUrl = new URL(publicEndpoint);

    signed.protocol = publicUrl.protocol;
    signed.host = publicUrl.host;

    return signed.toString();
  } catch {
    return signedUrl;
  }
};

/**
 * Upload an object to the configured object store.
 */
export const putObject = async (options: {
  bucket: string;
  key: string;
  body: Buffer | Uint8Array | Readable | string;
  contentType?: string;
  metadata?: Record<string, string>;
}): Promise<{ uri: string; etag?: string }> => {
  const client = getObjectStoreClient();
  const response = await client.send(
    new PutObjectCommand({
      Bucket: options.bucket,
      Key: options.key,
      Body: options.body,
      ContentType: options.contentType,
      Metadata: options.metadata
    })
  );

  return {
    uri: makeUri(options.bucket, options.key),
    etag: response.ETag
  };
};

/**
 * Retrieve an object from the configured object store.
 */
export const getObject = async (options: {
  bucket: string;
  key: string;
}): Promise<GetObjectCommandOutput> => {
  const client = getObjectStoreClient();
  return client.send(
    new GetObjectCommand({
      Bucket: options.bucket,
      Key: options.key
    })
  );
};

/**
 * Retrieve object metadata from the configured object store.
 */
export const headObject = async (options: {
  bucket: string;
  key: string;
}): Promise<HeadObjectCommandOutput> => {
  const client = getObjectStoreClient();
  return client.send(
    new HeadObjectCommand({
      Bucket: options.bucket,
      Key: options.key
    })
  );
};

const normalizeEndpoint = (endpoint: string): string => {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  return `https://${endpoint}`;
};
