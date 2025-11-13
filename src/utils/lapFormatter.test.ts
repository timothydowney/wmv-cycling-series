import { formatLapCount } from '../utils/lapFormatter';

describe('formatLapCount', () => {
  test('should format 1 as "One lap"', () => {
    expect(formatLapCount(1)).toBe('One lap');
  });

  test('should format 2 as "Two laps"', () => {
    expect(formatLapCount(2)).toBe('Two laps');
  });

  test('should format 3 as "Three laps"', () => {
    expect(formatLapCount(3)).toBe('Three laps');
  });

  test('should format 5 as "Five laps"', () => {
    expect(formatLapCount(5)).toBe('Five laps');
  });

  test('should format 10 as "Ten laps"', () => {
    expect(formatLapCount(10)).toBe('Ten laps');
  });

  test('should use number for counts > 10', () => {
    expect(formatLapCount(11)).toBe('11 laps');
  });

  test('should use number for counts > 20', () => {
    expect(formatLapCount(25)).toBe('25 laps');
  });
});
