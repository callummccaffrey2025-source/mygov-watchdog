import { withRetry } from '../lib/retry';

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const result = await withRetry(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('retries on failure then succeeds', async () => {
    let attempt = 0;
    const result = await withRetry(async () => {
      attempt++;
      if (attempt < 3) throw new Error('fail');
      return 'ok';
    }, { maxAttempts: 3, baseDelayMs: 10 });
    expect(result).toBe('ok');
    expect(attempt).toBe(3);
  });

  it('throws after max attempts', async () => {
    await expect(
      withRetry(() => Promise.reject(new Error('always fails')), {
        maxAttempts: 2,
        baseDelayMs: 10,
      }),
    ).rejects.toThrow('always fails');
  });

  it('respects shouldRetry predicate', async () => {
    let attempt = 0;
    await expect(
      withRetry(
        async () => {
          attempt++;
          throw new Error('fatal');
        },
        {
          maxAttempts: 5,
          baseDelayMs: 10,
          shouldRetry: () => false,
        },
      ),
    ).rejects.toThrow('fatal');
    expect(attempt).toBe(1);
  });
});
