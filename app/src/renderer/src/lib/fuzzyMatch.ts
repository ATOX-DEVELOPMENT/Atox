/** Совпадение запроса с путём: насколько оно хорошее и какие буквы пути совпали. */
export interface FuzzyMatch {
  score: number
  positions: number[]
}

/**
 * Ищет буквы запроса в пути по порядку, без учёта регистра. Выше ценятся совпадения в имени
 * файла, подряд и в начале слов: «fp» находит FilesPanel.tsx раньше, чем foo/package.json.
 * `null` — какой-то буквы запроса в пути нет.
 */
export function fuzzyMatch(query: string, path: string): FuzzyMatch | null {
  const needle = query.toLowerCase().replace(/\s+/g, '')
  const haystack = path.toLowerCase()
  const nameStart = path.lastIndexOf('/') + 1
  // Сначала пробуем найти всё в имени файла: такое совпадение почти всегда то, что ищут.
  return (
    matchFrom(needle, haystack, path, nameStart, nameStart) ??
    matchFrom(needle, haystack, path, 0, nameStart)
  )
}

function matchFrom(
  needle: string,
  haystack: string,
  path: string,
  start: number,
  nameStart: number
): FuzzyMatch | null {
  const positions: number[] = []
  let score = 0
  let index = start
  for (const char of needle) {
    const found = haystack.indexOf(char, index)
    if (found === -1) {
      return null
    }
    const previous = positions.at(-1)
    score += 1
    if (previous !== undefined && found === previous + 1) {
      score += 5
    }
    if (found === 0 || /[/._\-\s]/.test(path[found - 1]!) || isCamelHump(path, found)) {
      score += 3
    }
    if (found >= nameStart) {
      score += 2
    }
    positions.push(found)
    index = found + 1
  }
  return { score, positions }
}

function isCamelHump(path: string, index: number): boolean {
  const char = path[index]!
  const before = path[index - 1]!
  return char !== char.toLowerCase() && before === before.toLowerCase()
}
