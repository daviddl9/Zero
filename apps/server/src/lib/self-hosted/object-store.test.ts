import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  S3ObjectStore,
  createObjectStore,
  type ObjectStoreConfig,
  type ObjectStorePutOptions,
} from './object-store';

// Mock @aws-sdk/client-s3
vi.mock('@aws-sdk/client-s3', () => {
  const mockSend = vi.fn();
  return {
    S3Client: vi.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PutObjectCommand: vi.fn().mockImplementation((input) => ({ ...input, _type: 'PUT' })),
    GetObjectCommand: vi.fn().mockImplementation((input) => ({ ...input, _type: 'GET' })),
    DeleteObjectCommand: vi.fn().mockImplementation((input) => ({ ...input, _type: 'DELETE' })),
    HeadBucketCommand: vi.fn().mockImplementation((input) => ({ ...input, _type: 'HEAD_BUCKET' })),
    CreateBucketCommand: vi.fn().mockImplementation((input) => ({ ...input, _type: 'CREATE_BUCKET' })),
  };
});

describe('S3ObjectStore', () => {
  let store: S3ObjectStore;
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get the mocked send function
    const { S3Client } = await import('@aws-sdk/client-s3');
    const mockClient = new S3Client({});
    mockSend = mockClient.send as ReturnType<typeof vi.fn>;

    store = new S3ObjectStore({
      endpoint: 'http://localhost:9000',
      accessKeyId: 'minioadmin',
      secretAccessKey: 'minioadmin',
      bucket: 'test-bucket',
      region: 'us-east-1',
    });
  });

  describe('put', () => {
    it('should store a string value', async () => {
      mockSend.mockResolvedValueOnce({});

      await store.put('test-key', 'test-value');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Key: 'test-key',
          Body: 'test-value',
          _type: 'PUT',
        }),
      );
    });

    it('should store with custom metadata', async () => {
      mockSend.mockResolvedValueOnce({});

      const options: ObjectStorePutOptions = {
        customMetadata: { threadId: 'thread-123' },
      };

      await store.put('test-key', 'test-value', options);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Key: 'test-key',
          Body: 'test-value',
          Metadata: { threadId: 'thread-123' },
          _type: 'PUT',
        }),
      );
    });

    it('should store JSON data as string', async () => {
      mockSend.mockResolvedValueOnce({});

      const data = { messages: [{ id: 1, text: 'hello' }] };
      await store.put('data.json', JSON.stringify(data));

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          Body: JSON.stringify(data),
        }),
      );
    });
  });

  describe('get', () => {
    it('should retrieve a stored value', async () => {
      const mockBody = {
        transformToString: vi.fn().mockResolvedValue('test-value'),
      };
      mockSend.mockResolvedValueOnce({ Body: mockBody });

      const result = await store.get('test-key');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Key: 'test-key',
          _type: 'GET',
        }),
      );
      expect(result).not.toBeNull();
      expect(await result!.text()).toBe('test-value');
    });

    it('should return null for non-existent key', async () => {
      const error = new Error('NoSuchKey');
      (error as any).name = 'NoSuchKey';
      mockSend.mockRejectedValueOnce(error);

      const result = await store.get('non-existent');

      expect(result).toBeNull();
    });

    it('should propagate other errors', async () => {
      const error = new Error('Network error');
      mockSend.mockRejectedValueOnce(error);

      await expect(store.get('test-key')).rejects.toThrow('Network error');
    });
  });

  describe('delete', () => {
    it('should delete a key', async () => {
      mockSend.mockResolvedValueOnce({});

      await store.delete('test-key');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Key: 'test-key',
          _type: 'DELETE',
        }),
      );
    });
  });

  describe('exists', () => {
    it('should return true for existing key', async () => {
      const mockBody = {
        transformToString: vi.fn().mockResolvedValue('value'),
      };
      mockSend.mockResolvedValueOnce({ Body: mockBody });

      const result = await store.exists('test-key');

      expect(result).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      const error = new Error('NoSuchKey');
      (error as any).name = 'NoSuchKey';
      mockSend.mockRejectedValueOnce(error);

      const result = await store.exists('non-existent');

      expect(result).toBe(false);
    });
  });
});

describe('createObjectStore', () => {
  describe('S3/MinIO mode (self-hosted)', () => {
    it('should create S3ObjectStore when config is provided', () => {
      const config: ObjectStoreConfig = {
        endpoint: 'http://localhost:9000',
        accessKeyId: 'minioadmin',
        secretAccessKey: 'minioadmin',
        bucket: 'threads',
        region: 'us-east-1',
      };

      const store = createObjectStore(config);

      expect(store).toBeInstanceOf(S3ObjectStore);
    });
  });

  describe('R2 compatibility mode', () => {
    it('should wrap R2 bucket when provided', () => {
      // Mock R2Bucket interface
      const mockR2Bucket = {
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue({ text: () => 'value' }),
        delete: vi.fn().mockResolvedValue(undefined),
      };

      const store = createObjectStore(undefined, mockR2Bucket as any);

      // Should return R2-backed store
      expect(store).toBeDefined();
    });
  });
});
