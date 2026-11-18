export function normalizeAnswer(answer) {
  return answer.normalize('NFKD').replace(/\p{Diacritic}/gu, '')
    .replace(/[‘’]/g, "'").replace(/[‐‑‒–—]/g, '-')
    .trim().toLowerCase().replace(/\s+/g, ' ');
}

function typoLimit(value) {
  if (!/^[\p{L}][\p{L}\p{N} '\-]*$/u.test(value)) return 0;
  const letters = value.replace(/[^\p{L}]/gu, '').length;
  return letters < 4 ? 0 : letters >= 10 ? 2 : 1;
}

function editDistance(left, right, limit) {
  if (Math.abs(left.length - right.length) > limit) return limit + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  let beforePrevious = previous;
  for (let row = 1; row <= left.length; row++) {
    const current = [row];
    for (let column = 1; column <= right.length; column++) {
      current[column] = Math.min(current[column - 1] + 1, previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1));
      if (row > 1 && column > 1 && left[row - 1] === right[column - 2] && left[row - 2] === right[column - 1]) {
        current[column] = Math.min(current[column], beforePrevious[column - 2] + 1);
      }
    }
    if (Math.min(...current) > limit) return limit + 1;
    beforePrevious = previous;
    previous = current;
  }
  return previous[right.length];
}

export function findMatchingAnswer(index, input) {
  const key = normalizeAnswer(input);
  if (index.has(key)) return index.get(key);
  const limit = typoLimit(key);
  if (!limit) return undefined;
  let closest, best = limit + 1, ambiguous = false;
  for (const [variant, canonical] of index) {
    const budget = Math.min(limit, typoLimit(variant));
    if (!budget || Math.abs(variant.length - key.length) > budget) continue;
    const distance = editDistance(key, variant, budget);
    if (distance > budget || distance > best) continue;
    if (distance < best) {
      closest = canonical;
      best = distance;
      ambiguous = false;
    } else if (canonical !== closest) ambiguous = true;
  }
  return ambiguous ? undefined : closest;
}
