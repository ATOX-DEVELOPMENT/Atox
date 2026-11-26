import { homedir } from 'node:os'
import type { GitHubLinkPreview, LinkPreview, PageLinkPreview } from '../shared/linkPreview'
import type { GitHubAccounts } from './githubAccounts'
import { httpRequest } from './httpRequest'
import { runCommand } from './processes'
import {
  isInaccessibleRepository,
  toCheckStatus,
  toIssueState,
  toPullRequestState,
  toReviewDecision
} from './repository'
import type { ShellEnvironment } from './shellEnvironment'

/** Сколько ждать страницу или значок: карточка нужна, пока указатель на ссылке. */
const REQUEST_TIMEOUT_MS = 5_000
/** Заголовок и описание — в начале страницы; дальше не читаем, даже если она огромная. */
const MAX_PAGE_BYTES = 512 * 1024
const MAX_ICON_BYTES = 64 * 1024
const MAX_DESCRIPTION_LENGTH = 200
/** Сколько помнить карточку: при повторном наведении она появляется сразу. */
const CACHE_TTL_MS = 10 * 60_000
/** Карточки не вышло — возможно, пропала сеть: пробуем снова раньше. */
const EMPTY_CACHE_TTL_MS = 60_000
const MAX_CACHE_ENTRIES = 200

/** `github.com/owner/repo/pull/123` и `…/issues/123`, в том числе с хвостом вроде `/files`. */
const GITHUB_ITEM_PATH = /^\/([\w.-]+)\/([\w.-]+)\/(?:pull|issues)\/(\d+)(?:\/|$)/
const GITHUB_HOSTS: ReadonlySet<string> = new Set(['github.com', 'www.github.com'])
const WEB_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:'])

const GITHUB_ITEM_QUERY = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    nameWithOwner
    issueOrPullRequest(number: $number) {
      __typename
      ... on PullRequest {
        title
        state
        isDraft
        reviewDecision
        author { login }
        commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
      }
      ... on Issue {
        title
        state
        stateReason
        author { login }
      }
    }
  }
}`

interface GitHubItemNode {
  __typename: 'PullRequest' | 'Issue'
  title: string
  state: string
  isDraft?: boolean
  stateReason?: string | null
  reviewDecision?: string | null
  author: { login: string } | null
  commits?: { nodes: { commit: { statusCheckRollup: { state: string } | null } }[] }
}

interface GitHubItemResponse {
  data?: {
    repository: { nameWithOwner: string; issueOrPullRequest: GitHubItemNode | null } | null
  }
}

/**
 * Карточки ссылок из ответов агента. PR и issue GitHub — через `gh`, под учётной записью чата,
 * чтобы были видны и приватные репозитории; остальные страницы — их заголовок, описание
 * и значок. Наружу уходит только сам адрес ссылки, без куки.
 */
export class LinkPreviews {
  private readonly cache = new Map<
    string,
    { expiresAt: number; preview: Promise<LinkPreview | null> }
  >()

  constructor(
    private readonly shell: ShellEnvironment,
    private readonly accounts: GitHubAccounts
  ) {}

  /** Карточка ссылки; `null` — показать нечего. `account` — учётная запись gh чата. */
  preview(href: string, account?: string): Promise<LinkPreview | null> {
    if (!URL.canParse(href)) {
      return Promise.resolve(null)
    }
    const url = new URL(href)
    if (!WEB_PROTOCOLS.has(url.protocol)) {
      return Promise.resolve(null)
    }
    const key = `${url.href}\0${account ?? ''}`
    const cached = this.cache.get(key)
    if (cached && Date.now() < cached.expiresAt) {
      return cached.preview
    }
    const item = GITHUB_HOSTS.has(url.hostname) ? GITHUB_ITEM_PATH.exec(url.pathname) : null
    const preview = (
      item ? this.githubItem(item[1], item[2], Number(item[3]), account) : pagePreview(url)
    ).catch(() => null)
    this.remember(key, preview)
    return preview
  }

  private remember(key: string, preview: Promise<LinkPreview | null>): void {
    const entry = { expiresAt: Date.now() + CACHE_TTL_MS, preview }
    this.cache.delete(key)
    this.cache.set(key, entry)
    void preview.then((result) => {
      if (!result) {
        entry.expiresAt = Math.min(entry.expiresAt, Date.now() + EMPTY_CACHE_TTL_MS)
      }
    })
    // Map помнит порядок добавления: первая запись — самая давняя.
    if (this.cache.size > MAX_CACHE_ENTRIES) {
      this.cache.delete(this.cache.keys().next().value!)
    }
  }

  /**
   * PR или issue. Сначала под учётной записью чата (или активной), а если репозиторий ей
   * не виден — под остальными учётными записями gh.
   */
  private async githubItem(
    owner: string,
    name: string,
    number: number,
    account?: string
  ): Promise<GitHubLinkPreview | null> {
    const accounts = await this.accounts.list()
    const logins = [
      account,
      ...accounts.filter((entry) => entry.login !== account).map(({ login }) => login)
    ].filter((login): login is string => Boolean(login))
    // Без учётной записи чата первая попытка — под активной, без отдельного токена.
    const attempts: (string | undefined)[] = account ? logins : [undefined, ...logins]
    for (const login of attempts) {
      const token = login ? ((await this.accounts.token(login)) ?? undefined) : undefined
      if (login && !token) {
        continue
      }
      try {
        return await this.queryGitHubItem(owner, name, number, token)
      } catch (error) {
        if (!isInaccessibleRepository(error)) {
          return null
        }
      }
    }
    return null
  }

  private async queryGitHubItem(
    owner: string,
    name: string,
    number: number,
    token?: string
  ): Promise<GitHubLinkPreview | null> {
    const output = await runCommand(
      'gh',
      [
        'api',
        'graphql',
        '-f',
        `owner=${owner}`,
        '-f',
        `name=${name}`,
        '-F',
        `number=${number}`,
        '-f',
        `query=${GITHUB_ITEM_QUERY}`
      ],
      {
        cwd: homedir(),
        env: { ...(await this.shell.get()), ...(token && { GH_TOKEN: token }) },
        timeoutMs: REQUEST_TIMEOUT_MS * 2
      }
    )
    const repository = (JSON.parse(output) as GitHubItemResponse).data?.repository
    const node = repository?.issueOrPullRequest
    if (!repository || !node) {
      return null
    }
    const pullRequest = node.__typename === 'PullRequest'
    return {
      kind: 'github',
      type: pullRequest ? 'pull-request' : 'issue',
      repository: repository.nameWithOwner,
      number,
      title: node.title,
      state: pullRequest
        ? toPullRequestState(node.state, node.isDraft ?? false)
        : toIssueState(node.state, node.stateReason),
      author: node.author?.login ?? 'ghost',
      checks: pullRequest
        ? toCheckStatus(node.commits?.nodes[0]?.commit.statusCheckRollup?.state)
        : null,
      review: pullRequest ? toReviewDecision(node.reviewDecision) : null
    }
  }
}

/** Заголовок, описание и значок страницы — из её `<head>`. */
async function pagePreview(url: URL): Promise<PageLinkPreview | null> {
  const response = await httpRequest(url.href, {
    headers: { Accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  const type = response.headers.get('content-type') ?? ''
  if (!response.ok || !/html/i.test(type)) {
    await response.body?.cancel()
    return null
  }
  const bytes = await readLimited(response, MAX_PAGE_BYTES)
  const html = decodeText(bytes, charsetOf(type))
  const head = html.slice(0, indexOrEnd(html, /<\/head\s*>/i))
  const meta = metaTags(head)
  const title = cleanText(
    meta.get('og:title') ?? meta.get('twitter:title') ?? /<title[^>]*>([^<]*)/i.exec(head)?.[1]
  )
  if (!title) {
    return null
  }
  const description = cleanText(
    meta.get('og:description') ?? meta.get('description') ?? meta.get('twitter:description')
  )
  const icon = await pageIcon(head, url)
  return {
    kind: 'page',
    site: url.hostname.replace(/^www\./, ''),
    title,
    ...(description && { description: truncate(description, MAX_DESCRIPTION_LENGTH) }),
    ...(icon && { icon })
  }
}

/** Значок из `<link rel="icon">`, иначе `/favicon.ico`; `undefined` — его нет. */
async function pageIcon(head: string, url: URL): Promise<string | undefined> {
  const link = Array.from(head.matchAll(/<link\s[^>]*>/gi), ([tag]) => attributes(tag)).find(
    (attrs) => /(^|\s)icon(\s|$)/i.test(attrs.get('rel') ?? '') && attrs.get('href')
  )
  const href = link?.get('href') ?? '/favicon.ico'
  if (!URL.canParse(href, url)) {
    return undefined
  }
  try {
    const response = await httpRequest(new URL(href, url).href, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
    const type = (response.headers.get('content-type') ?? '').split(';')[0]!.trim()
    if (!response.ok || !type.startsWith('image/')) {
      await response.body?.cancel()
      return undefined
    }
    const bytes = await readLimited(response, MAX_ICON_BYTES + 1)
    if (bytes.length === 0 || bytes.length > MAX_ICON_BYTES) {
      return undefined
    }
    return `data:${type};base64,${Buffer.from(bytes).toString('base64')}`
  } catch {
    return undefined
  }
}

/** Начало тела ответа, не больше `limit` байт: остальное не скачивается. */
async function readLimited(response: Response, limit: number): Promise<Uint8Array> {
  const reader = response.body?.getReader()
  if (!reader) {
    return new Uint8Array()
  }
  const chunks: Uint8Array[] = []
  let size = 0
  while (size < limit) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    chunks.push(value)
    size += value.length
  }
  await reader.cancel().catch(() => {})
  return Buffer.concat(chunks).subarray(0, limit)
}

function charsetOf(contentType: string): string {
  return /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ?? 'utf-8'
}

function decodeText(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset).decode(bytes)
  } catch {
    return new TextDecoder().decode(bytes)
  }
}

function indexOrEnd(text: string, pattern: RegExp): number {
  const index = text.search(pattern)
  return index === -1 ? text.length : index
}

/** `<meta property|name="…" content="…">` страницы: имя в нижнем регистре → содержимое. */
function metaTags(head: string): Map<string, string> {
  const tags = new Map<string, string>()
  for (const [tag] of head.matchAll(/<meta\s[^>]*>/gi)) {
    const attrs = attributes(tag)
    const name = (attrs.get('property') ?? attrs.get('name'))?.toLowerCase()
    const content = attrs.get('content')
    if (name && content && !tags.has(name)) {
      tags.set(name, content)
    }
  }
  return tags
}

/** Атрибуты тега: имя в нижнем регистре → значение. */
function attributes(tag: string): Map<string, string> {
  const attrs = new Map<string, string>()
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    attrs.set(match[1]!.toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '')
  }
  return attrs
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  laquo: '«',
  raquo: '»'
}

/** Текст из HTML: без сущностей и лишних пробелов; пустой — `undefined`. */
function cleanText(raw: string | undefined): string | undefined {
  const text = raw
    ?.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, code: string) => {
      if (code.startsWith('#')) {
        const hex = code[1] === 'x' || code[1] === 'X'
        const point = hex ? parseInt(code.slice(2), 16) : Number(code.slice(1))
        return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity
      }
      return NAMED_ENTITIES[code.toLowerCase()] ?? entity
    })
    .replace(/\s+/g, ' ')
    .trim()
  return text || undefined
}

function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text
}
