import { timeAgo } from '../lib/timeAgo';

describe('timeAgo', () => {
  it('returns "just now" for recent timestamps', () => {
    const now = new Date().toISOString();
    expect(timeAgo(now)).toBe('Just now');
  });

  it('returns minutes for timestamps within an hour', () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(timeAgo(tenMinutesAgo)).toBe('10m ago');
  });

  it('returns hours for timestamps within a day', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(threeHoursAgo)).toBe('3h ago');
  });

  it('returns days for timestamps within a month', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(fiveDaysAgo)).toBe('5d ago');
  });

  it('returns weeks for timestamps within 2 months', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(twoWeeksAgo)).toBe('2w ago');
  });

  it('handles null/undefined gracefully', () => {
    expect(timeAgo(null as any)).toBeTruthy();
    expect(timeAgo(undefined as any)).toBeTruthy();
  });
});
