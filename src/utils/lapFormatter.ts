/**
 * Convert a lap count to a human-readable string.
 * Examples:
 *   1 -> "One lap"
 *   2 -> "Two laps"
 *   5 -> "Five laps"
 *   10 -> "10 laps"
 */
export function formatLapCount(count: number): string {
  const lapWord = count === 1 ? 'lap' : 'laps';
  
  const numberWords: Record<number, string> = {
    1: 'One',
    2: 'Two',
    3: 'Three',
    4: 'Four',
    5: 'Five',
    6: 'Six',
    7: 'Seven',
    8: 'Eight',
    9: 'Nine',
    10: 'Ten',
  };

  const numberWord = numberWords[count] || count.toString();
  return `${numberWord} ${lapWord}`;
}
