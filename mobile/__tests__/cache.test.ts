import { getCached, setCached, isCacheFresh, clearCache } from '../lib/cache';

// Mock the storage module
jest.mock('../lib/storage', () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        Object.keys(store).forEach(k => delete store[k]);
        return Promise.resolve();
      }),
    },
  };
});

describe('cache', () => {
  beforeEach(async () => {
    await clearCache('test_key');
  });

  it('returns null for uncached key', async () => {
    const result = await getCached('nonexistent');
    expect(result).toBeNull();
  });

  it('stores and retrieves data', async () => {
    await setCached('test_key', { hello: 'world' });
    const result = await getCached('test_key');
    expect(result).toEqual({ hello: 'world' });
  });

  it('reports freshness correctly', async () => {
    await setCached('test_key', 'data');
    const fresh = await isCacheFresh('test_key', 60000);
    expect(fresh).toBe(true);

    const stale = await isCacheFresh('test_key', 0);
    expect(stale).toBe(false);
  });

  it('clears specific key', async () => {
    await setCached('test_key', 'data');
    await clearCache('test_key');
    const result = await getCached('test_key');
    expect(result).toBeNull();
  });
});
