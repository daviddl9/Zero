/**
 * Object Store - S3/MinIO-compatible Object Storage
 *
 * Provides an abstraction layer for object storage that works with both:
 * - Cloudflare R2 (for Cloudflare Workers deployment)
 * - MinIO/S3 (for self-hosted deployment)
 *
 * This replaces direct R2 bucket usage (THREADS_BUCKET) for thread storage.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';

/**
 * Configuration for S3/MinIO object store
 */
export interface ObjectStoreConfig {
  /** S3/MinIO endpoint URL (e.g., http://minio:9000) */
  endpoint: string;
  /** Access key ID */
  accessKeyId: string;
  /** Secret access key */
  secretAccessKey: string;
  /** Bucket name for thread storage */
  bucket: string;
  /** S3 region (required by SDK, use 'us-east-1' for MinIO) */
  region?: string;
}

/**
 * Options for put operations
 */
export interface ObjectStorePutOptions {
  /** Custom metadata to store with the object */
  customMetadata?: Record<string, string>;
  /** Content type (defaults to application/json) */
  contentType?: string;
}

/**
 * Result from get operations - mimics R2Object interface
 */
export interface ObjectStoreResult {
  /** Get the body as text */
  text(): Promise<string>;
  /** Get the body as JSON */
  json<T = unknown>(): Promise<T>;
  /** Custom metadata */
  customMetadata?: Record<string, string>;
}

/**
 * Common interface for object stores (S3/MinIO and R2)
 */
export interface IObjectStore {
  put(key: string, value: string | Buffer, options?: ObjectStorePutOptions): Promise<void>;
  get(key: string): Promise<ObjectStoreResult | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/**
 * S3/MinIO-backed object store implementation
 */
export class S3ObjectStore implements IObjectStore {
  private client: S3Client;
  private bucket: string;

  constructor(config: ObjectStoreConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region || 'us-east-1',
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true, // Required for MinIO
    });
  }

  /**
   * Store a value in the bucket
   */
  async put(key: string, value: string | Buffer, options?: ObjectStorePutOptions): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: value,
      ContentType: options?.contentType || 'application/json',
      Metadata: options?.customMetadata,
    });

    await this.client.send(command);
  }

  /**
   * Retrieve a value from the bucket
   */
  async get(key: string): Promise<ObjectStoreResult | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        return null;
      }

      // Store the body content for multiple reads
      let bodyContent: string | null = null;

      return {
        async text(): Promise<string> {
          if (bodyContent === null) {
            bodyContent = await response.Body!.transformToString();
          }
          return bodyContent;
        },
        async json<T = unknown>(): Promise<T> {
          if (bodyContent === null) {
            bodyContent = await response.Body!.transformToString();
          }
          return JSON.parse(bodyContent) as T;
        },
        customMetadata: response.Metadata,
      };
    } catch (error: unknown) {
      // Handle "not found" errors gracefully
      if (error instanceof Error && (error.name === 'NoSuchKey' || error.name === 'NotFound')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete a value from the bucket
   */
  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.get(key);
    return result !== null;
  }

  /**
   * Ensure the bucket exists, creating it if necessary
   */
  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error: unknown) {
      if (error instanceof Error && (error.name === 'NotFound' || error.name === 'NoSuchBucket')) {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        console.log(`[ObjectStore] Created bucket: ${this.bucket}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Get the S3 client (for health checks)
   */
  getClient(): S3Client {
    return this.client;
  }
}

/**
 * R2-backed object store wrapper
 * Wraps Cloudflare R2Bucket to match IObjectStore interface
 */
export class R2ObjectStoreWrapper implements IObjectStore {
  private bucket: R2Bucket;

  constructor(bucket: R2Bucket) {
    this.bucket = bucket;
  }

  async put(key: string, value: string | Buffer, options?: ObjectStorePutOptions): Promise<void> {
    await this.bucket.put(key, value, {
      customMetadata: options?.customMetadata,
    });
  }

  async get(key: string): Promise<ObjectStoreResult | null> {
    const result = await this.bucket.get(key);
    if (!result) {
      return null;
    }

    // R2Object already has text() and json() methods
    return {
      text: () => result.text(),
      json: <T = unknown>() => result.json() as Promise<T>,
      customMetadata: result.customMetadata,
    };
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.bucket.get(key);
    return result !== null;
  }
}

/**
 * Create an object store instance based on configuration
 *
 * @param config S3/MinIO configuration (for self-hosted mode)
 * @param r2Bucket R2 bucket (for Cloudflare Workers mode)
 * @returns Object store instance
 */
export function createObjectStore(
  config?: ObjectStoreConfig,
  r2Bucket?: R2Bucket,
): IObjectStore {
  if (config) {
    return new S3ObjectStore(config);
  }

  if (r2Bucket) {
    return new R2ObjectStoreWrapper(r2Bucket);
  }

  throw new Error('Either S3 config or R2 bucket must be provided');
}

/**
 * Parse S3 configuration from environment variables
 */
export function parseS3Config(): ObjectStoreConfig | null {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  const bucket = process.env.S3_BUCKET;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  return {
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucket,
    region: process.env.S3_REGION || 'us-east-1',
  };
}
