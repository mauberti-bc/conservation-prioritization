import { S3Client } from '@aws-sdk/client-s3';
import { expect } from 'chai';
import { describe } from 'mocha';
import {
  bulkDeleteFilesFromS3,
  deleteFileFromS3,
  generateDatasetS3FileKey,
  generateQueueS3FileKey,
  getS3HostUrl,
  getS3SignedURL,
  _getObjectStoreBucketName,
  _getObjectStoreEndpoint,
  _getS3Client,
  _getSourceObjectStoreBucketName,
  _getSourceObjectStoreEndpoint
} from './file-utils';

/**
 * Sets or clears environment variables for a test.
 *
 * Assigning `undefined` to a `process.env` key stores the string "undefined", so
 * `undefined` values are deleted instead.
 *
 * @param {Record<string, string | undefined>} values Variables to set, or `undefined` to clear.
 * @returns {void} No return value.
 */
const setEnv = (values: Record<string, string | undefined>): void => {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

describe('deleteFileFromS3', () => {
  it('returns null when no key specified', async () => {
    const result = await deleteFileFromS3(null as unknown as string);

    expect(result).to.be.null;
  });
});

describe('bulkDeleteFilesFromS3', () => {
  it('returns null when no keys provided', async () => {
    const result = await bulkDeleteFilesFromS3([]);

    expect(result).to.be.null;
  });
});

describe('getS3SignedURL', () => {
  it('returns null when no key specified', async () => {
    const result = await getS3SignedURL(null as unknown as string);

    expect(result).to.be.null;
  });
});

describe('getS3HostUrl', () => {
  const OBJECT_STORE_URL = process.env.OBJECT_STORE_URL;
  const OBJECT_STORE_BUCKET_NAME = process.env.OBJECT_STORE_BUCKET_NAME;

  afterEach(() => {
    setEnv({ OBJECT_STORE_URL });
    setEnv({ OBJECT_STORE_BUCKET_NAME });
  });

  it('should yield a default S3 host url', () => {
    setEnv({ OBJECT_STORE_URL: undefined, OBJECT_STORE_BUCKET_NAME: undefined });

    const result = getS3HostUrl();

    expect(result).to.equal('https://nrs.objectstore.gov.bc.ca');
  });

  it('should successfully produce an S3 host url', () => {
    process.env.OBJECT_STORE_URL = 'http://s3.host.example.com';
    process.env.OBJECT_STORE_BUCKET_NAME = 'test-bucket-name';

    const result = getS3HostUrl();

    expect(result).to.equal('http://s3.host.example.com/test-bucket-name');
  });

  it('should successfully append a key to an S3 host url', () => {
    process.env.OBJECT_STORE_URL = 's3.host.example.com';
    process.env.OBJECT_STORE_BUCKET_NAME = 'test-bucket-name';

    const result = getS3HostUrl('my-test-file.txt');

    expect(result).to.equal('https://s3.host.example.com/test-bucket-name/my-test-file.txt');
  });
});

describe('_getS3Client', () => {
  const OBJECT_STORE_ACCESS_KEY_ID = process.env.OBJECT_STORE_ACCESS_KEY_ID;

  afterEach(() => {
    setEnv({ OBJECT_STORE_ACCESS_KEY_ID });
  });

  it('should return an S3 client', () => {
    process.env.OBJECT_STORE_ACCESS_KEY_ID = 'aaaa';
    process.env.OBJECT_STORE_SECRET_KEY_ID = 'bbbb';

    const result = _getS3Client();
    expect(result).to.be.instanceOf(S3Client);
  });
});

describe('_getObjectStoreBucketName', () => {
  const OBJECT_STORE_BUCKET_NAME = process.env.OBJECT_STORE_BUCKET_NAME;

  afterEach(() => {
    setEnv({ OBJECT_STORE_BUCKET_NAME });
  });

  it('should return an object store bucket name', () => {
    process.env.OBJECT_STORE_BUCKET_NAME = 'test-bucket1';

    const result = _getObjectStoreBucketName();
    expect(result).to.equal('test-bucket1');
  });

  it('should return its default value', () => {
    setEnv({ OBJECT_STORE_BUCKET_NAME: undefined });

    const result = _getObjectStoreBucketName();
    expect(result).to.equal('');
  });
});

describe('_getSourceObjectStoreBucketName', () => {
  const OBJECT_STORE_BUCKET_NAME = process.env.OBJECT_STORE_BUCKET_NAME;
  const SOURCE_OBJECT_STORE_BUCKET_NAME = process.env.SOURCE_OBJECT_STORE_BUCKET_NAME;

  afterEach(() => {
    setEnv({ OBJECT_STORE_BUCKET_NAME });
    setEnv({ SOURCE_OBJECT_STORE_BUCKET_NAME });
  });

  it('should return a source object store bucket name', () => {
    process.env.SOURCE_OBJECT_STORE_BUCKET_NAME = 'source-bucket';
    process.env.OBJECT_STORE_BUCKET_NAME = 'write-bucket';

    const result = _getSourceObjectStoreBucketName();
    expect(result).to.equal('source-bucket');
  });

  it('should not fall back to the writable object store bucket name', () => {
    setEnv({ SOURCE_OBJECT_STORE_BUCKET_NAME: undefined });
    process.env.OBJECT_STORE_BUCKET_NAME = 'write-bucket';

    expect(() => _getSourceObjectStoreBucketName()).to.throw('SOURCE_OBJECT_STORE_BUCKET_NAME is not configured.');
  });
});

describe('_getObjectStoreEndpoint', () => {
  const OBJECT_STORE_URL = process.env.OBJECT_STORE_URL;

  afterEach(() => {
    setEnv({ OBJECT_STORE_URL });
  });

  it('should return an object store bucket name that http protocol', () => {
    process.env.OBJECT_STORE_URL = 'http://s3.host.example.com';

    const result = _getObjectStoreEndpoint();
    expect(result).to.equal('http://s3.host.example.com');
  });

  it('should return an object store bucket name that https protocol', () => {
    process.env.OBJECT_STORE_URL = 'https://s3.host.example.com';

    const result = _getObjectStoreEndpoint();
    expect(result).to.equal('https://s3.host.example.com');
  });

  it('should return an object store bucket name that had no protocol', () => {
    process.env.OBJECT_STORE_URL = 's3.host.example.com';

    const result = _getObjectStoreEndpoint();
    expect(result).to.equal('https://s3.host.example.com');
  });

  it('should return its default value', () => {
    setEnv({ OBJECT_STORE_ENDPOINT: undefined, OBJECT_STORE_URL: undefined });

    const result = _getObjectStoreEndpoint();
    expect(result).to.equal('https://nrs.objectstore.gov.bc.ca');
  });
});

describe('_getSourceObjectStoreEndpoint', () => {
  const OBJECT_STORE_ENDPOINT = process.env.OBJECT_STORE_ENDPOINT;
  const OBJECT_STORE_URL = process.env.OBJECT_STORE_URL;
  const SOURCE_OBJECT_STORE_ENDPOINT = process.env.SOURCE_OBJECT_STORE_ENDPOINT;
  const SOURCE_OBJECT_STORE_URL = process.env.SOURCE_OBJECT_STORE_URL;

  afterEach(() => {
    setEnv({ OBJECT_STORE_ENDPOINT });
    setEnv({ OBJECT_STORE_URL });
    setEnv({ SOURCE_OBJECT_STORE_ENDPOINT });
    setEnv({ SOURCE_OBJECT_STORE_URL });
  });

  it('should return a source object store endpoint', () => {
    process.env.SOURCE_OBJECT_STORE_URL = 'source.s3.host.example.com';

    const result = _getSourceObjectStoreEndpoint();
    expect(result).to.equal('https://source.s3.host.example.com');
  });

  it('should not fall back to the writable object store endpoint', () => {
    setEnv({ SOURCE_OBJECT_STORE_ENDPOINT: undefined, SOURCE_OBJECT_STORE_URL: undefined });
    process.env.OBJECT_STORE_ENDPOINT = 'write.s3.host.example.com';
    process.env.OBJECT_STORE_URL = 'write.s3.host.example.com';

    expect(() => _getSourceObjectStoreEndpoint()).to.throw(
      'SOURCE_OBJECT_STORE_URL or SOURCE_OBJECT_STORE_ENDPOINT is not configured.'
    );
  });
});

describe('generateQueueS3FileKey', () => {
  it('returns an s3 key', async () => {
    const result = generateQueueS3FileKey({
      queueId: 1,
      datasetUUID: '123-456-789',
      fileName: 'testFileName'
    });

    expect(result).to.equal('queue/1/datasets/123-456-789/dwca/testFileName');
  });
});

describe('generateDatasetS3FileKey', () => {
  it('returns an s3 key', async () => {
    const result = generateDatasetS3FileKey({
      datasetUUID: '123-456-789',
      fileName: 'testFileName'
    });

    expect(result).to.equal('datasets/123-456-789/dwca/testFileName');
  });
});
