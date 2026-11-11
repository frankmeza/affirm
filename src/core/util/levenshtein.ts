export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost)
    }
    prev = curr
  }
  return prev[b.length]!
}

/** Closest candidate by case-insensitive edit distance, or `undefined` if nothing is close enough. */
export function closest(input: string, candidates: readonly string[]): string | undefined {
  const needle = input.toLowerCase()
  const limit = Math.max(2, Math.floor(input.length / 3))
  let best: string | undefined
  let bestDistance = Infinity
  for (const candidate of candidates) {
    const d = levenshtein(needle, candidate.toLowerCase())
    if (d < bestDistance) {
      best = candidate
      bestDistance = d
    }
  }
  return bestDistance <= limit ? best : undefined
}
