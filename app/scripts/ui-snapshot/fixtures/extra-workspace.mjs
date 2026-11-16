/**
 * Данные для состояний группы workspace: холсты с экранами и историей, доска задач, страница
 * репозитория, терминал.
 *
 * - `gh` — поддельный: аккаунты, токены и ответы GraphQL страницы репозитория (PR и issue).
 * - Доска ходит на GitHub не через `gh`, а напрямую (`net.fetch` в главном процессе), поэтому
 *   главный процесс запускается с `NODE_OPTIONS=--require fetch-patch.cjs`: запросы к
 *   `api.github.com/graphql` получают выдуманные ответы, остальные идут как обычно.
 * - `git clone` — зависает: задачи из очереди «готовят worktree» (колонка Progress), а те, кому
 *   не хватило места, остаются в Queue. Остальные команды git идут к настоящему git.
 * - `HOME` — своя папка с `.zshrc`: оболочка входа ставит наш PATH первым (так найдутся `gh` и
 *   `git`) и рисует короткое приглашение в терминале.
 *
 * Применяется, когда запускается вся съёмка или хотя бы одно состояние `workspace-*`.
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { delimiter, join } from 'node:path'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function wanted() {
  const index = process.argv.indexOf('--only')
  if (index === -1) {
    return true
  }
  return (process.argv[index + 1] ?? '').split(',').some((id) => id.startsWith('workspace-'))
}

// ---------------------------------------------------------------------------------------------
// GitHub: учётные записи, репозитории, задачи
// ---------------------------------------------------------------------------------------------

const GH_ACCOUNTS = {
  hosts: {
    'github.com': [
      { login: 'atox-demo-alex', active: true, state: 'success' },
      { login: 'atox-demo-studio', active: false, state: 'success' }
    ]
  }
}

/** Аватар владельца: SVG-кружок с буквой (CSP окна разрешает `data:`). */
function avatar(letter, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${color}"/><text x="32" y="43" font-family="Helvetica" font-size="32" font-weight="700" text-anchor="middle" fill="#fff">${letter}</text></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

const OWNERS = {
  'atox-demo-alex': { login: 'atox-demo-alex', avatarUrl: avatar('A', '#3b82f6') },
  'atox-demo-studio': { login: 'atox-demo-studio', avatarUrl: avatar('S', '#e0763a') }
}

/** Репозитории, которые видны аккаунтам (окно выбора репозиториев доски). */
const REPOSITORIES = [
  { name: 'atox-demo-alex/fern', account: 'atox-demo-alex', private: false, open: 6, pushedAgo: 2 * HOUR },
  { name: 'atox-demo-alex/orbit', account: 'atox-demo-alex', private: true, open: 4, pushedAgo: 5 * HOUR },
  { name: 'atox-demo-studio/billing-api', account: 'atox-demo-studio', private: true, open: 3, pushedAgo: 9 * HOUR },
  { name: 'atox-demo-studio/design-system', account: 'atox-demo-studio', private: false, open: 12, pushedAgo: 2 * DAY },
  { name: 'atox-demo-studio/mobile-app', account: 'atox-demo-studio', private: true, open: 8, pushedAgo: 3 * DAY },
  { name: 'atox-demo-alex/notes-sync', account: 'atox-demo-alex', private: false, open: 2, pushedAgo: 6 * DAY },
  { name: 'atox-demo-alex/landing-site', account: 'atox-demo-alex', private: false, open: 1, pushedAgo: 12 * DAY },
  { name: 'atox-demo-alex/dotfiles', account: 'atox-demo-alex', private: false, open: 0, pushedAgo: 40 * DAY }
]

const LABELS = {
  bug: ['bug', 'd73a4a'],
  feature: ['enhancement', '1f9d8b'],
  docs: ['documentation', '0075ca'],
  perf: ['performance', 'e99695'],
  design: ['design', 'a371f7'],
  good: ['good first issue', '7057ff']
}

/** Задачи доски: колонка (`column`) нужна только для `board.json`, GitHub её не знает. */
const BOARD_ISSUES = [
  // Fern
  { id: 'I_fern_101', repo: 'atox-demo-alex/fern', n: 101, title: 'Checkout total is off by a cent when a discount applies', labels: ['bug'], assignees: ['atox-demo-alex'], ago: 1 * HOUR },
  { id: 'I_fern_98', repo: 'atox-demo-alex/fern', n: 98, title: 'Add a dark mode toggle to the settings page', labels: ['feature', 'design'], assignees: [], ago: 3 * HOUR },
  { id: 'I_fern_94', repo: 'atox-demo-alex/fern', n: 94, title: 'Cart badge flickers on slow networks', labels: ['bug'], assignees: [], ago: 5 * HOUR, column: 'queue', queuedAt: 3 },
  { id: 'I_fern_90', repo: 'atox-demo-alex/fern', n: 90, title: 'Support gift messages at checkout', labels: ['feature'], assignees: ['atox-demo-alex'], ago: 9 * HOUR, column: 'queue', queuedAt: 4 },
  { id: 'I_fern_82', repo: 'atox-demo-alex/fern', n: 82, title: 'Upgrade the storefront to React 19', labels: ['feature'], assignees: [], ago: 12 * HOUR, column: 'queue', queuedAt: 1 },
  { id: 'I_fern_87', repo: 'atox-demo-alex/fern', n: 87, title: 'Empty cart page needs a call to action', labels: ['design', 'good'], assignees: ['atox-demo-alex'], ago: 20 * HOUR, column: 'review', chat: 'c-fern-dark' },
  { id: 'I_fern_85', repo: 'atox-demo-alex/fern', n: 85, title: 'Document the order export CSV format', labels: ['docs'], assignees: [], ago: 26 * HOUR, state: 'CLOSED', column: 'done' },
  // Orbit
  { id: 'I_orbit_212', repo: 'atox-demo-alex/orbit', n: 212, title: 'Dashboard query takes 4 s on accounts with 10k events', labels: ['perf'], assignees: ['atox-demo-alex'], ago: 2 * HOUR },
  { id: 'I_orbit_205', repo: 'atox-demo-alex/orbit', n: 205, title: 'Let teams pin charts to the top of the dashboard', labels: ['feature'], assignees: [], ago: 7 * HOUR },
  { id: 'I_orbit_79', repo: 'atox-demo-alex/orbit', n: 79, title: 'Retry the nightly report email when SMTP times out', labels: ['bug'], assignees: [], ago: 14 * HOUR, column: 'queue', queuedAt: 2 },
  { id: 'I_orbit_198', repo: 'atox-demo-alex/orbit', n: 198, title: 'Export the usage report as CSV', labels: ['feature'], assignees: ['atox-demo-alex'], ago: 30 * HOUR, column: 'review', chat: 'c-orbit-1' },
  // Billing API
  { id: 'I_bill_45', repo: 'atox-demo-studio/billing-api', n: 45, title: 'Retry failed webhooks with exponential backoff', labels: ['feature'], assignees: ['atox-demo-alex'], ago: 4 * HOUR },
  { id: 'I_bill_41', repo: 'atox-demo-studio/billing-api', n: 41, title: 'Invoice PDF shows the wrong VAT line for EU customers', labels: ['bug'], assignees: [], ago: 22 * HOUR },
  { id: 'I_bill_38', repo: 'atox-demo-studio/billing-api', n: 38, title: 'Rate limit the public invoices endpoint', labels: ['perf'], assignees: [], ago: 28 * HOUR, state: 'CLOSED', column: 'done' }
]

/** Репозитории на доске. */
const BOARD_REPOSITORIES = [
  { fullName: 'atox-demo-alex/fern', account: 'atox-demo-alex' },
  { fullName: 'atox-demo-alex/orbit', account: 'atox-demo-alex' },
  { fullName: 'atox-demo-studio/billing-api', account: 'atox-demo-studio' }
]

/** Данные для `fetch-patch.cjs`: ответы GraphQL доски. */
function boardData(now) {
  const issue = (item) => {
    const [owner] = item.repo.split('/')
    return {
      id: item.id,
      number: item.n,
      title: item.title,
      url: `https://github.com/${item.repo}/issues/${item.n}`,
      state: item.state ?? 'OPEN',
      updatedAt: new Date(now - item.ago).toISOString(),
      author: { login: item.assignees[0] ?? 'atox-demo-alex' },
      assignees: { nodes: item.assignees.map((login) => ({ login })) },
      labels: { nodes: item.labels.map((key) => ({ name: LABELS[key][0], color: LABELS[key][1] })) },
      repository: { nameWithOwner: item.repo, owner: OWNERS[owner] }
    }
  }
  return {
    issues: BOARD_ISSUES.map((item) => ({ ...issue(item), body: `${item.title}.\n\nSteps and context are in the thread.` })),
    repositories: REPOSITORIES.map((repository) => ({
      account: repository.account,
      nameWithOwner: repository.name,
      isPrivate: repository.private,
      isArchived: false,
      hasIssuesEnabled: true,
      pushedAt: new Date(now - repository.pushedAgo).toISOString(),
      owner: OWNERS[repository.name.split('/')[0]],
      issues: { totalCount: repository.open }
    }))
  }
}

const FETCH_PATCH = (data) => `'use strict'
// Подмена сети главного процесса Atox: запросы доски к GitHub GraphQL получают выдуманные ответы.
if (process.versions.electron && process.type === 'browser') {
  const data = ${JSON.stringify(data)}
  const Module = require('node:module')
  const load = Module._load
  let patched = false
  // Модуль «electron» при запуске из NODE_OPTIONS ещё не готов: подменяем net.fetch, когда его первым подключит приложение.
  Module._load = function (request, ...rest) {
    const loaded = load.call(this, request, ...rest)
    if (request === 'electron' && !patched && loaded && loaded.net) {
      patched = true
      patchNet(loaded.net)
    }
    return loaded
  }
  function patchNet(net) {
  const original = net.fetch.bind(net)
  const reply = (body) =>
    new Response(JSON.stringify({ data: body }), { status: 200, headers: { 'content-type': 'application/json' } })
  net.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url
    if (url !== 'https://api.github.com/graphql') {
      return original(input, init)
    }
    const { query, variables = {} } = JSON.parse(init.body)
    const token = String((init.headers ?? {}).Authorization ?? '')
    const account = token.replace(/^bearer demo-token-/, '')
    const page = { hasNextPage: false, endCursor: null }
    if (query.includes('viewer')) {
      const nodes = data.repositories.filter((repository) => repository.account === account)
      return reply({ viewer: { repositories: { pageInfo: page, nodes } } })
    }
    if (query.includes('nodes(ids')) {
      return reply({ nodes: data.issues.filter(({ id }) => variables.ids.includes(id)) })
    }
    if (query.includes('node(id')) {
      return reply({ node: { body: data.issues.find(({ id }) => id === variables.id)?.body ?? '' } })
    }
    const full = variables.owner + '/' + variables.name
    const nodes = data.issues.filter(
      (issue) => issue.repository.nameWithOwner === full && issue.state === 'OPEN'
    )
    return reply({ repository: { issues: { pageInfo: page, nodes } } })
  }
  }
}
`

// ---------------------------------------------------------------------------------------------
// Страница репозитория (gh api graphql)
// ---------------------------------------------------------------------------------------------

/** PR и issue репозиториев проектов: `fern` и `orbit`. */
const REPOSITORY_DATA = {
  fern: {
    name: 'atox-demo-alex/fern',
    pullRequests: {
      open: [
        { n: 104, title: 'Round order totals in cents, not floats', state: 'OPEN', branch: 'fix/checkout-rounding', add: 38, del: 12, review: 'APPROVED', checks: 'SUCCESS', author: 'atox-demo-alex', comments: 3, ago: 40 * MINUTE },
        { n: 103, title: 'Add a dark mode toggle', state: 'OPEN', draft: true, branch: 'feat/dark-mode', add: 214, del: 31, review: null, checks: 'PENDING', author: 'atox-demo-alex', comments: 0, ago: 3 * HOUR },
        { n: 102, title: 'Replace the cart badge polling with a socket', state: 'OPEN', branch: 'perf/cart-badge-socket', add: 96, del: 140, review: 'CHANGES_REQUESTED', checks: 'FAILURE', author: 'atox-demo-mira', comments: 7, ago: 7 * HOUR },
        { n: 100, title: 'Upgrade the storefront to React 19', state: 'OPEN', branch: 'chore/react-19', add: 412, del: 389, review: 'REVIEW_REQUIRED', checks: 'SUCCESS', author: 'atox-demo-mira', comments: 11, ago: 1 * DAY },
        { n: 97, title: 'Translate the checkout flow to Spanish', state: 'OPEN', branch: 'i18n/es-checkout', add: 540, del: 8, review: 'APPROVED', checks: 'SUCCESS', author: 'atox-demo-jonas', comments: 2, ago: 2 * DAY },
        { n: 95, title: 'Document the order export CSV format', state: 'OPEN', branch: 'docs/order-export', add: 64, del: 0, review: null, checks: null, author: 'atox-demo-alex', comments: 1, ago: 4 * DAY }
      ],
      closed: [
        { n: 99, title: 'Fix the empty cart layout on small phones', state: 'MERGED', branch: 'fix/empty-cart', add: 22, del: 9, review: 'APPROVED', checks: 'SUCCESS', author: 'atox-demo-jonas', comments: 4, ago: 5 * HOUR },
        { n: 96, title: 'Show the discount code in the order summary', state: 'MERGED', branch: 'feat/discount-summary', add: 71, del: 14, review: 'APPROVED', checks: 'SUCCESS', author: 'atox-demo-mira', comments: 5, ago: 1 * DAY },
        { n: 93, title: 'Try a masonry grid for the catalog', state: 'CLOSED', branch: 'exp/masonry', add: 305, del: 120, review: null, checks: 'FAILURE', author: 'atox-demo-alex', comments: 9, ago: 3 * DAY },
        { n: 91, title: 'Bump the payments SDK', state: 'MERGED', branch: 'chore/payments-sdk', add: 12, del: 12, review: 'APPROVED', checks: 'SUCCESS', author: 'atox-demo-jonas', comments: 0, ago: 6 * DAY }
      ]
    },
    issues: {
      open: [
        { n: 101, title: 'Checkout total is off by a cent when a discount applies', labels: ['bug'], assignees: ['atox-demo-alex'], author: 'atox-demo-mira', comments: 6, ago: 1 * HOUR },
        { n: 98, title: 'Add a dark mode toggle to the settings page', labels: ['feature', 'design'], assignees: [], author: 'atox-demo-jonas', comments: 2, ago: 3 * HOUR },
        { n: 94, title: 'Cart badge flickers on slow networks', labels: ['bug'], assignees: [], author: 'atox-demo-alex', comments: 4, ago: 5 * HOUR },
        { n: 90, title: 'Support gift messages at checkout', labels: ['feature'], assignees: ['atox-demo-alex', 'atox-demo-mira'], author: 'atox-demo-jonas', comments: 12, ago: 9 * HOUR },
        { n: 87, title: 'Empty cart page needs a call to action', labels: ['design', 'good'], assignees: ['atox-demo-alex'], author: 'atox-demo-mira', comments: 0, ago: 20 * HOUR },
        { n: 80, title: 'Document the order export CSV format', labels: ['docs'], assignees: [], author: 'atox-demo-jonas', comments: 1, ago: 5 * DAY }
      ],
      closed: [
        { n: 85, title: 'Order confirmation email is sent twice', labels: ['bug'], assignees: ['atox-demo-mira'], author: 'atox-demo-alex', comments: 8, ago: 26 * HOUR, reason: 'COMPLETED' },
        { n: 78, title: 'Offer gift wrapping as a paid add-on', labels: ['feature'], assignees: [], author: 'atox-demo-jonas', comments: 5, ago: 6 * DAY, reason: 'NOT_PLANNED' },
        { n: 72, title: 'Product images load slowly on mobile', labels: ['perf'], assignees: ['atox-demo-jonas'], author: 'atox-demo-mira', comments: 3, ago: 9 * DAY, reason: 'COMPLETED' }
      ]
    }
  },
  orbit: {
    name: 'atox-demo-alex/orbit',
    pullRequests: {
      open: [
        { n: 215, title: 'Cache the dashboard aggregates per workspace', state: 'OPEN', branch: 'perf/dashboard-cache', add: 188, del: 41, review: 'REVIEW_REQUIRED', checks: 'SUCCESS', author: 'atox-demo-alex', comments: 2, ago: 2 * HOUR },
        { n: 214, title: 'Export the usage report as CSV', state: 'OPEN', draft: true, branch: 'feat/usage-csv', add: 120, del: 4, review: null, checks: 'PENDING', author: 'atox-demo-mira', comments: 0, ago: 1 * DAY }
      ],
      closed: [
        { n: 210, title: 'Retry the nightly report email', state: 'MERGED', branch: 'fix/report-retry', add: 34, del: 6, review: 'APPROVED', checks: 'SUCCESS', author: 'atox-demo-jonas', comments: 3, ago: 2 * DAY }
      ]
    },
    issues: {
      open: [
        { n: 212, title: 'Dashboard query takes 4 s on accounts with 10k events', labels: ['perf'], assignees: ['atox-demo-alex'], author: 'atox-demo-mira', comments: 5, ago: 2 * HOUR },
        { n: 205, title: 'Let teams pin charts to the top of the dashboard', labels: ['feature'], assignees: [], author: 'atox-demo-jonas', comments: 1, ago: 7 * HOUR }
      ],
      closed: []
    }
  }
}

const GH_SCRIPT = (accounts, repositories, labels) => `
const fs = require('node:fs')
const path = require('node:path')
const accounts = ${JSON.stringify(accounts)}
const repositories = ${JSON.stringify(repositories)}
const labels = ${JSON.stringify(labels)}
const args = process.argv.slice(2)
const out = (value) => process.stdout.write(typeof value === 'string' ? value : JSON.stringify(value))
const fail = (message) => {
  process.stderr.write(message + '\\n')
  process.exit(1)
}
const flag = (name) => args[args.indexOf(name) + 1]

if (args[0] === 'auth' && args[1] === 'status') {
  out(accounts)
} else if (args[0] === 'auth' && args[1] === 'token') {
  out('demo-token-' + flag('--user') + '\\n')
} else if (args[0] === 'api' && args[1] === 'graphql') {
  const cwd = process.cwd()
  if (!fs.existsSync(path.join(cwd, '.git'))) {
    fail('fatal: not a git repository (or any of the parent directories): .git')
  }
  const repository = repositories[path.basename(cwd)]
  if (!repository) {
    fail('none of the git remotes configured for this repository point to a known GitHub host')
  }
  const query = args.find((arg) => arg.startsWith('query=')) ?? ''
  const kind = query.includes('list: pullRequests') ? 'pullRequests' : 'issues'
  const state = /states: OPEN/.test(query) ? 'open' : 'closed'
  const now = Date.now()
  const iso = (ms) => new Date(now - ms).toISOString()
  const convert = {
    pullRequests: (pr) => ({
      number: pr.n,
      title: pr.title,
      url: 'https://github.com/' + repository.name + '/pull/' + pr.n,
      state: pr.state,
      isDraft: pr.draft === true,
      updatedAt: iso(pr.ago),
      headRefName: pr.branch,
      additions: pr.add,
      deletions: pr.del,
      reviewDecision: pr.review,
      author: { login: pr.author },
      comments: { totalCount: pr.comments },
      commits: { nodes: [{ commit: { statusCheckRollup: pr.checks ? { state: pr.checks } : null } }] }
    }),
    issues: (issue) => ({
      number: issue.n,
      title: issue.title,
      url: 'https://github.com/' + repository.name + '/issues/' + issue.n,
      state: state === 'open' ? 'OPEN' : 'CLOSED',
      stateReason: issue.reason ?? null,
      updatedAt: iso(issue.ago),
      author: { login: issue.author },
      assignees: { nodes: issue.assignees.map((login) => ({ login })) },
      comments: { totalCount: issue.comments },
      labels: { nodes: issue.labels.map((key) => ({ name: labels[key][0], color: labels[key][1] })) }
    })
  }[kind]
  const nodes = args.some((arg) => arg.startsWith('after=')) ? [] : repository[kind][state].map(convert)
  out({
    data: {
      repository: {
        url: 'https://github.com/' + repository.name,
        nameWithOwner: repository.name,
        list: { totalCount: repository[kind][state].length, pageInfo: { hasNextPage: false, endCursor: null }, nodes }
      }
    }
  })
}
`

// ---------------------------------------------------------------------------------------------
// Холсты
// ---------------------------------------------------------------------------------------------

const sha = (content) => createHash('sha256').update(content).digest('hex')

/** Экран телефона: заголовок и несколько блоков. */
function phone(title, body, accent = '#3b82f6') {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,Helvetica,sans-serif;background:#f6f7f9;color:#14161a;padding:56px 20px 24px;min-height:100vh}
h1{font-size:28px;margin:0 0 20px}.card{background:#fff;border-radius:16px;padding:16px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,.08);display:flex;justify-content:space-between;align-items:center}
.muted{color:#6b7280;font-size:13px}.row{display:flex;justify-content:space-between;margin:10px 0;font-size:15px}.total{font-weight:700;font-size:18px}
button{width:100%;border:0;border-radius:14px;background:${accent};color:#fff;font-size:17px;font-weight:600;padding:16px;margin-top:16px}
.check{width:72px;height:72px;border-radius:50%;background:${accent};margin:80px auto 24px;color:#fff;font-size:40px;display:grid;place-items:center}
</style></head><body><h1>${title}</h1>${body}</body></html>`
}

const CART = (extra = '') =>
  phone(
    'Your cart',
    `<div class="card"><div><b>Linen shirt</b><div class="muted">Size M · Sage</div></div><b>$64.00</b></div>
<div class="card"><div><b>Canvas tote</b><div class="muted">Natural</div></div><b>$22.00</b></div>
${extra}<div class="row"><span>Subtotal</span><span>$86.00</span></div><div class="row"><span>Discount</span><span>−$8.60</span></div>
<div class="row total"><span>Total</span><span>$77.40</span></div><button>Checkout</button>`
  )
const PAY = (label) =>
  phone(
    'Payment',
    `<div class="card"><div><b>Visa •••• 4242</b><div class="muted">Expires 09/28</div></div><span>✓</span></div>
<div class="card"><div><b>Apple Pay</b></div><span class="muted">Not set up</span></div>
<div class="row total"><span>Pay now</span><span>$77.40</span></div><button>${label}</button>`
  )
const DONE = phone('Order confirmed', `<div class="check">✓</div><p style="text-align:center" class="muted">We sent the receipt to alex@example.com</p><div class="card"><b>Order #1042</b><span class="muted">Arrives Thu</span></div>`)
const WELCOME = phone('Welcome to Fern', `<p class="muted">Pick what you shop for and we will tailor the home page.</p><div class="card"><b>Clothing</b><span>›</span></div><div class="card"><b>Home</b><span>›</span></div><div class="card"><b>Gifts</b><span>›</span></div><button>Continue</button>`, '#1f9d8b')
const NOTIFY = phone('Stay in the loop', `<p class="muted">Order updates and early access to sales.</p><div class="card"><b>Order updates</b><span>On</span></div><div class="card"><b>Offers</b><span>Off</span></div><button>Allow notifications</button>`, '#1f9d8b')

function web(title, accent = '#3b82f6') {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,Helvetica,sans-serif;background:#0f1115;color:#e8eaee}
nav{display:flex;gap:24px;padding:20px 48px;border-bottom:1px solid #23262d}.logo{font-weight:700;margin-right:auto}
main{padding:40px 48px}h1{font-size:34px;margin:0 0 28px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.tile{background:#171a21;border:1px solid #23262d;border-radius:14px;padding:24px;height:180px}.big{font-size:40px;font-weight:700;color:${accent}}
.muted{color:#8b93a1}</style></head><body><nav><span class="logo">Orbit</span><span>Overview</span><span>Events</span><span>Reports</span></nav>
<main><h1>${title}</h1><div class="grid"><div class="tile"><div class="muted">Active users</div><div class="big">12,480</div></div>
<div class="tile"><div class="muted">Events today</div><div class="big">3.2M</div></div><div class="tile"><div class="muted">Error rate</div><div class="big">0.04%</div></div></div></main></body></html>`
}

/**
 * Холсты: `files` — HTML экранов (последний — текущий), `versions` — их история; у каждого
 * экрана версия `created`, потом правки агента.
 */
function canvasDefinitions(filesRoot) {
  const screen = (id, name, device, x, versions) => ({ id, name, device, x, y: 0, versions, file: join(filesRoot, `${id}.html`) })
  return [
    {
      id: 'cv-checkout',
      name: 'Checkout redesign',
      chatId: 'c-fern-checkout',
      projectId: 'p-fern',
      archived: false,
      updatedAgo: 25 * MINUTE,
      createdAgo: 2 * DAY,
      screens: [
        screen('s-cart', 'Cart', 'iphone', 0, [
          { cause: 'created', ago: 2 * DAY, html: CART('<!-- v1 -->') },
          { cause: 'edit', ago: 5 * HOUR, html: CART('<!-- v2 -->'), fix: 'Show the discount as its own line' },
          { cause: 'edit', ago: 25 * MINUTE, html: CART() }
        ]),
        screen('s-pay', 'Payment', 'iphone', 520, [
          { cause: 'created', ago: 1 * DAY, html: PAY('Pay now') },
          { cause: 'edit', ago: 50 * MINUTE, html: PAY('Pay $77.40'), fix: 'Put the amount on the pay button' }
        ]),
        screen('s-done', 'Order confirmed', 'iphone', 1040, [{ cause: 'created', ago: 1 * DAY, html: DONE }])
      ],
      links: [
        { id: 'l-cart-pay', from: 's-cart', to: 's-pay', on: 'Checkout', anchor: { x: 20, y: 366, width: 350, height: 52 } },
        { id: 'l-pay-done', from: 's-pay', to: 's-done', on: 'Pay now', anchor: { x: 20, y: 296, width: 350, height: 52 } }
      ],
      groups: [{ id: 'g-flow', name: 'Checkout flow', screens: ['s-cart', 's-pay', 's-done'] }]
    },
    {
      id: 'cv-onboarding',
      name: 'Onboarding flow',
      chatId: 'c-fern-empty',
      projectId: 'p-fern',
      archived: false,
      updatedAgo: 3 * HOUR,
      createdAgo: 1 * DAY,
      screens: [
        screen('s-welcome', 'Welcome', 'iphone', 0, [{ cause: 'created', ago: 3 * HOUR, html: WELCOME }]),
        screen('s-notify', 'Notifications', 'iphone', 520, [{ cause: 'created', ago: 3 * HOUR, html: NOTIFY }])
      ],
      links: [{ id: 'l-welcome-notify', from: 's-welcome', to: 's-notify', on: 'Continue', anchor: { x: 20, y: 380, width: 350, height: 54 } }]
    },
    {
      id: 'cv-dashboard',
      name: 'Dashboard concepts',
      chatId: 'c-orbit-1',
      projectId: 'p-orbit',
      archived: false,
      updatedAgo: 1 * DAY,
      createdAgo: 4 * DAY,
      screens: [screen('s-overview', 'Overview', 'web', 0, [{ cause: 'created', ago: 1 * DAY, html: web('Overview') }])],
      links: []
    },
    {
      id: 'cv-landing',
      name: 'Landing page v1',
      chatId: 'c-fern-dark',
      projectId: 'p-fern',
      archived: true,
      updatedAgo: 6 * DAY,
      createdAgo: 9 * DAY,
      screens: [screen('s-landing', 'Hero', 'web', 0, [{ cause: 'created', ago: 6 * DAY, html: web('Fern for every season', '#1f9d8b') }])],
      links: []
    },
    {
      id: 'cv-notes-widgets',
      name: 'Notes widgets',
      chatId: 'c-notes-1',
      projectId: 'p-notes',
      archived: true,
      updatedAgo: 12 * DAY,
      createdAgo: 14 * DAY,
      screens: [screen('s-widget', 'Home widget', 'iphone', 0, [{ cause: 'created', ago: 12 * DAY, html: NOTIFY }])],
      links: []
    }
  ]
}

async function writeCanvases(context, now) {
  const filesRoot = join(context.repositories, 'canvas-files')
  const historyRoot = join(context.userData, 'canvas-history')
  await mkdir(filesRoot, { recursive: true })
  const canvases = []
  for (const definition of canvasDefinitions(filesRoot)) {
    const screens = []
    for (const screen of definition.screens) {
      const versions = []
      for (const [index, version] of screen.versions.entries()) {
        const hash = sha(version.html)
        const directory = join(historyRoot, definition.id, screen.id)
        await mkdir(directory, { recursive: true })
        await writeFile(join(directory, `${hash}.html`), version.html)
        versions.push({
          id: `${screen.id}-v${index + 1}`,
          savedAt: now - version.ago,
          cause: version.cause,
          hash,
          ...(version.fix && { fix: version.fix })
        })
      }
      const current = screen.versions.at(-1)
      await writeFile(screen.file, current.html)
      const { versions: _versions, ...rest } = screen
      screens.push({ ...rest, revision: versions.length, missing: false, buildError: null, updatedAt: now - current.ago, versions })
    }
    canvases.push({
      id: definition.id,
      name: definition.name,
      chatId: definition.chatId,
      projectId: definition.projectId,
      archived: definition.archived,
      screens,
      links: definition.links,
      groups: definition.groups ?? [],
      view: null,
      createdAt: now - definition.createdAgo,
      updatedAt: now - definition.updatedAgo
    })
  }
  await writeFile(join(context.userData, 'canvases.json'), JSON.stringify({ version: 1, canvases }, null, 2))
}

// ---------------------------------------------------------------------------------------------
// Доска
// ---------------------------------------------------------------------------------------------

async function writeBoard(context, now) {
  const cards = {}
  for (const item of BOARD_ISSUES) {
    if (!item.column) {
      continue
    }
    const account = BOARD_REPOSITORIES.find(({ fullName }) => fullName === item.repo).account
    cards[item.id] = {
      column: item.column,
      account,
      ...(item.queuedAt !== undefined && { queuedAt: now - (10 - item.queuedAt) * MINUTE }),
      ...(item.chat && { chatId: item.chat }),
      ...(item.column === 'done' && { doneAt: now - 2 * HOUR })
    }
  }
  await writeFile(
    join(context.userData, 'board.json'),
    JSON.stringify({ version: 1, repositories: BOARD_REPOSITORIES, cards }, null, 2)
  )
}

// ---------------------------------------------------------------------------------------------

/** Первая программа `name` в PATH, кроме нашей папки. */
function findProgram(name, skip) {
  for (const directory of (process.env['PATH'] ?? '').split(delimiter)) {
    if (directory && directory !== skip) {
      try {
        execFileSync('test', ['-x', join(directory, name)])
        return join(directory, name)
      } catch {
        // нет в этой папке
      }
    }
  }
  throw new Error(`${name} not found in PATH`)
}

export async function extend(context) {
  if (!wanted()) {
    return {}
  }
  const now = Date.now()
  const root = context.repositories
  const bin = join(root, 'workspace-bin')
  // Та же папка, что у группы settings: общая домашняя, у каждой группы свои файлы в ней.
  const home = join(root, 'home')
  await mkdir(bin, { recursive: true })
  await mkdir(home, { recursive: true })

  // gh
  const node = process.execPath
  const ghScript = join(bin, 'gh.cjs')
  const repositories = Object.fromEntries(
    Object.entries(REPOSITORY_DATA).map(([name, data]) => [name, data])
  )
  await writeFile(ghScript, GH_SCRIPT(GH_ACCOUNTS, repositories, LABELS))
  await writeFile(join(bin, 'gh'), `#!/bin/sh\nexec "${node}" "${ghScript}" "$@"\n`)
  await chmod(join(bin, 'gh'), 0o755)

  // git: клонирование «зависает», остальное — настоящий git
  const realGit = findProgram('git', bin)
  await writeFile(
    join(bin, 'git'),
    `#!/bin/sh\nfor arg in "$@"; do\n  if [ "$arg" = "clone" ]; then exec sleep 300; fi\ndone\nexec "${realGit}" "$@"\n`
  )
  await chmod(join(bin, 'git'), 0o755)

  // оболочка: наш PATH первым и короткое приглашение
  await writeFile(
    join(home, '.zshrc'),
    `export PATH="${bin}:$PATH"\nPROMPT='%F{blue}%1~%f %# '\nunset RPROMPT\nunsetopt PROMPT_SP\nPROMPT_EOL_MARK=''\n`
  )

  // сеть главного процесса
  const patch = join(bin, 'fetch-patch.cjs')
  await writeFile(patch, FETCH_PATCH(boardData(now)))

  await writeCanvases(context, now)
  await writeBoard(context, now)

  const nodeOptions = [process.env['NODE_OPTIONS'], `--require ${patch}`].filter(Boolean).join(' ')
  return { env: { HOME: home, PATH: `${bin}${delimiter}${process.env['PATH'] ?? ''}`, NODE_OPTIONS: nodeOptions } }
}
