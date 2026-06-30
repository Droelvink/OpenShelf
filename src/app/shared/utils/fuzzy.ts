/**
 * Returns a match score >= 0 if all query characters appear in `text` in order,
 * or -1 if they don't. Higher score = better match.
 * Rewards consecutive character runs and word-boundary hits.
 */
export function fuzzyScore(text: string, query: string): number {
  let qi = 0;
  let score = 0;
  let consecutive = 0;

  for (let i = 0; i < text.length && qi < query.length; i++) {
    if (text[i] === query[qi]) {
      qi++;
      score += ++consecutive;
      if (i === 0 || text[i - 1] === ' ' || text[i - 1] === '-' || text[i - 1] === '_' || text[i - 1] === '.') {
        score += 8;
      }
    } else {
      consecutive = 0;
    }
  }

  return qi === query.length ? score : -1;
}
