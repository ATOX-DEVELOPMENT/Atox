/**
 * Демо-профиль для снимков интерфейса: выдуманные проекты, чаты и переписки вместо личных
 * данных. Создаёт папку профиля (`<dir>-dev`: так приложение называет профиль при разработке)
 * и git-репозитории проектов в `/tmp/atox-demo`.
 */
import { execFileSync } from 'node:child_process'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { conversations as baseConversations } from './fixtures/conversations.mjs'
import { PROJECTS, SPACES } from './fixtures/projects.mjs'

const here = dirname(fileURLToPath(import.meta.url))

/** Папка демо-репозиториев: у каждого запуска своя (см. run.mjs), читается при сборке профиля. */
const repositories = () => process.env['ATOX_DEMO_REPOSITORIES'] ?? '/tmp/atox-demo'

async function makeRepository(path) {
  await mkdir(join(path, 'src', 'checkout'), { recursive: true })
  await writeFile(join(path, 'README.md'), '# Demo\n')
  await writeFile(
    join(path, 'src', 'checkout', 'total.ts'),
    'export function orderTotal(lines: Line[], discount: number): number {\n  const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0)\n  return Number((subtotal * (1 - discount)).toFixed(2))\n}\n'
  )
  const git = (...args) => execFileSync('git', args, { cwd: path, stdio: 'ignore' })
  git('init', '-q', '-b', 'main')
  git('-c', 'user.name=Demo', '-c', 'user.email=demo@example.com', 'add', '.')
  git('-c', 'user.name=Demo', '-c', 'user.email=demo@example.com', 'commit', '-q', '-m', 'Initial commit')
  // Незакоммиченная правка: страница изменений показывает diff.
  await writeFile(
    join(path, 'src', 'checkout', 'total.ts'),
    'const cents = (value: number) => Math.round(value * 100)\n\nexport function orderTotal(lines: Line[], discount: number): number {\n  return (\n    lines.reduce((sum, line) => sum + Math.round(cents(line.price) * line.qty * (1 - discount)), 0) / 100\n  )\n}\n'
  )
}

/**
 * Дополнения профиля: каждый файл `fixtures/extra-*.mjs` может экспортировать
 * `async function extend(context)` — поменять `context.projects`, `context.settings`,
 * `context.conversations` (id чата → лента), положить свои файлы в `context.userData` и вернуть
 * `{ env }` — переменные окружения приложения (например, PATH с поддельным `gh`).
 */
async function runExtensions(context) {
  const env = {}
  const files = (await readdir(join(here, 'fixtures'))).filter((name) => /^extra-.*\.mjs$/.test(name)).sort()
  for (const name of files) {
    const module = await import(`./fixtures/${name}`)
    Object.assign(env, (await module.extend?.(context))?.env)
  }
  return env
}

/** Собирает профиль; возвращает путь для `--user-data-dir` и окружение приложения. */
export async function buildDemoProfile(directory) {
  const REPOSITORIES = repositories()
  const userData = `${directory}-dev`
  await rm(userData, { recursive: true, force: true })
  await mkdir(join(userData, 'conversations'), { recursive: true })

  const projects = []
  for (const { repository, chats, ...project } of PROJECTS) {
    const path = join(REPOSITORIES, project.name.toLowerCase().replaceAll(' ', '-'))
    await rm(path, { recursive: true, force: true })
    await mkdir(path, { recursive: true })
    if (repository) {
      await makeRepository(path)
    }
    projects.push({ ...project, path, chats })
  }
  const settings = {
    version: 1,
    defaultAgent: 'claude',
    agentModels: { claude: { model: 'sonnet', effort: 'medium' }, codex: {} },
    sidebarWidth: 280,
    terminalWidth: 480,
    shortcuts: {},
    shareUsageStats: false,
    playSounds: false,
    profileName: 'Alex Morgan',
    theme: 'system',
    accent: 'blue',
    sidebarButtons: 'list',
    boardMaxAgents: 2,
    boardAgent: { agent: 'claude' }
  }
  const conversations = { ...baseConversations }
  const context = { userData, repositories: REPOSITORIES, projects, settings, conversations, spaces: SPACES }
  const env = await runExtensions(context)

  await writeFile(
    join(userData, 'projects.json'),
    JSON.stringify(
      { version: 1, spaces: context.spaces, activeSpaceId: context.spaces[0].id, projects: context.projects },
      null,
      2
    )
  )
  await writeFile(join(userData, 'settings.json'), JSON.stringify(context.settings, null, 2))
  for (const [chatId, items] of Object.entries(context.conversations)) {
    await writeFile(
      join(userData, 'conversations', `${chatId}.json`),
      JSON.stringify({ version: 1, items, queue: [], sessionAgent: 'claude', lastAgent: 'claude' })
    )
  }
  await writeFile(
    join(userData, 'plan-limits.json'),
    JSON.stringify({
      version: 1,
      state: {
        claude: {
          limits: [
            { label: 'Current week (all models)', shortLabel: 'Week', percent: 42, resetsAt: Date.UTC(2026, 10, 19, 9) },
            { label: 'Current week (Opus)', shortLabel: 'Opus week', model: 'Opus', percent: 12, resetsAt: Date.UTC(2026, 10, 19, 9) }
          ],
          updatedAt: Date.UTC(2026, 10, 16, 9)
        },
        codex: {
          limits: [{ label: 'Monthly limit', shortLabel: 'Month', percent: 13, resetsAt: Date.UTC(2026, 11, 1) }],
          updatedAt: Date.UTC(2026, 10, 16, 9)
        }
      }
    })
  )
  await writeFile(
    join(userData, 'token-spend.json'),
    JSON.stringify({
      version: 1,
      days: {
        '2026-11-14': { claude: { input: 21_000, output: 380_000, cached: 41_000_000 }, codex: { input: 9_000, output: 120_000, cached: 6_000_000 } },
        '2026-11-15': { claude: { input: 33_000, output: 610_000, cached: 78_000_000 } },
        '2026-11-16': { claude: { input: 2_500, output: 923_000, cached: 272_800_000 } }
      }
    })
  )
  return { profile: userData.replace(/-dev$/, ''), env }
}
