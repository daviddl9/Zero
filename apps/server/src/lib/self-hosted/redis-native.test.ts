import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NativeRedisClient,
  NativeRedisRateLimiter,
  createNativeRedisClient,
  type NativeRedisConfig,
} from './redis-native';

// Mock ioredis
vi.mock('ioredis', () => {
  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
    multi: vi.fn(),
    on: vi.fn(),
    quit: vi.fn(),
  };

  // Mock multi/exec for atomic operations
  mockRedis.multi.mockReturnValue({
    incr: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn(),
  });

  return {
    default: vi.fn().mockImplementation(() => mockRedis),
    Redis: vi.fn().mockImplementation(() => mockRedis),
  };
});

describe('NativeRedisClient', () => {
  let client: NativeRedisClient;
  let mockRedis: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { default: Redis } = await import('ioredis');
    mockRedis = new Redis();

    client = new NativeRedisClient({
      host: 'localhost',
      port: 6379,
    });
  });

  describe('get', () => {
    it('should retrieve a string value', async () => {
      mockRedis.get.mockResolvedValueOnce('test-value');

      const result = await client.get('test-key');

      expect(result).toBe('test-value');
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null for non-existent key', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await client.get('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should store a string value', async () => {
      mockRedis.set.mockResolvedValueOnce('OK');

      await client.set('test-key', 'test-value');

      expect(mockRedis.set).toHaveBeenCalledWith('test-key', 'test-value');
    });

    it('should store with expiration in seconds', async () => {
      mockRedis.set.mockResolvedValueOnce('OK');

      await client.set('test-key', 'test-value', { ex: 300 });

      expect(mockRedis.set).toHaveBeenCalledWith('test-key', 'test-value', 'EX', 300);
    });
  });

  describe('del', () => {
    it('should delete a key', async () => {
      mockRedis.del.mockResolvedValueOnce(1);

      await client.del('test-key');

      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
    });
  });
});

describe('NativeRedisRateLimiter', () => {
  let limiter: NativeRedisRateLimiter;
  let mockRedis: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { default: Redis } = await import('ioredis');
    mockRedis = new Redis();

    limiter = new NativeRedisRateLimiter(mockRedis, {
      points: 10,
      duration: 60,
      keyPrefix: 'ratelimit:test:',
    });
  });

  describe('limit', () => {
    it('should allow request when under limit', async () => {
      const mockMulti = mockRedis.multi();
      mockMulti.exec.mockResolvedValueOnce([
        [null, 5], // Current count after increment
        [null, 1], // TTL result
      ]);
      mockRedis.ttl.mockResolvedValueOnce(55);

      const result = await limiter.limit('user-123');

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(5); // 10 - 5 = 5 remaining
    });

    it('should deny request when over limit', async () => {
      const mockMulti = mockRedis.multi();
      mockMulti.exec.mockResolvedValueOnce([
        [null, 11], // Current count after increment (over limit)
        [null, 1], // TTL result
      ]);
      mockRedis.ttl.mockResolvedValueOnce(30);

      const result = await limiter.limit('user-123');

      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should calculate reset time correctly', async () => {
      const mockMulti = mockRedis.multi();
      mockMulti.exec.mockResolvedValueOnce([
        [null, 5],
        [null, 1],
      ]);
      mockRedis.ttl.mockResolvedValueOnce(45);

      const result = await limiter.limit('user-123');

      // Reset should be ~45 seconds from now
      const expectedReset = Date.now() + 45 * 1000;
      expect(result.reset).toBeGreaterThanOrEqual(expectedReset - 1000);
      expect(result.reset).toBeLessThanOrEqual(expectedReset + 1000);
    });
  });
});

describe('createNativeRedisClient', () => {
  it('should create client with config', () => {
    const config: NativeRedisConfig = {
      host: 'localhost',
      port: 6379,
      password: 'secret',
    };

    const client = createNativeRedisClient(config);

    expect(client).toBeInstanceOf(NativeRedisClient);
  });

  it('should create client from environment variables', () => {
    process.env.REDIS_HOST = 'redis-host';
    process.env.REDIS_PORT = '6380';
    process.env.REDIS_PASSWORD = 'password';

    const client = createNativeRedisClient();

    expect(client).toBeInstanceOf(NativeRedisClient);

    // Cleanup
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_PASSWORD;
  });
});
