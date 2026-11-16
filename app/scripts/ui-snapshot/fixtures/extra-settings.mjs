/**
 * Данные для состояний группы settings: поддельные `gh` и домашняя папка с выдуманными скиллами
 * и серверами MCP (иначе списки показали бы настоящие плагины пользователя), чаты в архиве.
 *
 * Применяется, когда запускается вся съёмка или хотя бы одно состояние `settings-*`: так
 * чужие запуски с `--only` не получают лишних чатов и подмены окружения.
 */
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const HOUR = 3_600_000
const base = Date.UTC(2026, 10, 16, 9, 0, 0)

function wanted() {
  const index = process.argv.indexOf('--only')
  if (index === -1) {
    return true
  }
  return (process.argv[index + 1] ?? '').split(',').some((id) => id.startsWith('settings-'))
}

const GH_ACCOUNTS = {
  hosts: {
    'github.com': [
      { login: 'atox-demo-alex', active: true, state: 'success' },
      { login: 'atox-demo-studio', active: false, state: 'success' }
    ]
  }
}

/** Поддельный `gh`: отвечает на `auth status`, остальное молча принимает. */
async function writeGh(directory) {
  await mkdir(directory, { recursive: true })
  const script = `#!/bin/sh
if [ "$1" = "auth" ] && [ "$2" = "status" ]; then
  cat <<'JSON'
${JSON.stringify(GH_ACCOUNTS)}
JSON
fi
exit 0
`
  await writeFile(join(directory, 'gh'), script)
  await chmod(join(directory, 'gh'), 0o755)
}

/** Крохотный сервер MCP по stdio: подключается и отдаёт несколько инструментов. */
const MCP_SERVER = `
const tools = (names) => names.map((name) => ({ name, description: name, inputSchema: { type: 'object', properties: {} } }))
const names = JSON.parse(process.argv[2] ?? '[]')
let buffer = ''
process.stdin.on('data', (chunk) => {
  buffer += chunk
  let end
  while ((end = buffer.indexOf('\\n')) >= 0) {
    const line = buffer.slice(0, end)
    buffer = buffer.slice(end + 1)
    if (!line.trim()) continue
    const message = JSON.parse(line)
    const reply = (result) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }) + '\\n')
    if (message.method === 'initialize') {
      reply({ protocolVersion: message.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'demo', version: '1.0.0' } })
    } else if (message.method === 'tools/list') {
      reply({ tools: tools(names) })
    } else if (message.id !== undefined) {
      reply({})
    }
  }
})
`

const SKILLS = [
  ['release-notes', 'Draft release notes from merged pull requests and group them by area.'],
  ['sql-review', 'Review a query for missing indexes, N+1 patterns and unsafe migrations.'],
  ['write-tests', 'Add focused unit tests next to the code you just changed.']
]

/** Два выдуманных плагина Claude Code из локального каталога плагинов в домашней папке. */
const PLUGINS = [
  ['review-kit', 'Review pull requests with a checklist and suggest focused fixes.', 'review'],
  ['release-helper', 'Prepare changelogs and version bumps for a release.', 'release']
]

async function writePlugins(home) {
  const claude = join(home, '.claude')
  const marketplace = join(claude, 'plugins', 'marketplaces', 'demo-plugins')
  const installed = {}
  for (const [name, description, command] of PLUGINS) {
    const source = join(marketplace, 'plugins', name)
    const cache = join(claude, 'plugins', 'cache', 'demo-plugins', name, '1.0.0')
    for (const directory of [source, cache]) {
      await mkdir(join(directory, '.claude-plugin'), { recursive: true })
      await mkdir(join(directory, 'commands'), { recursive: true })
      await writeFile(
        join(directory, '.claude-plugin', 'plugin.json'),
        JSON.stringify({ name, version: '1.0.0', description })
      )
      await writeFile(join(directory, 'commands', `${command}.md`), `---\ndescription: ${description}\n---\n\n${description}\n`)
    }
    installed[`${name}@demo-plugins`] = [
      { scope: 'user', installPath: cache, version: '1.0.0', installedAt: '2026-11-01T10:00:00.000Z', lastUpdated: '2026-11-01T10:00:00.000Z' }
    ]
  }
  await mkdir(join(marketplace, '.claude-plugin'), { recursive: true })
  await writeFile(
    join(marketplace, '.claude-plugin', 'marketplace.json'),
    JSON.stringify({
      name: 'demo-plugins',
      owner: { name: 'Demo' },
      plugins: PLUGINS.map(([name, description]) => ({ name, description, source: `./plugins/${name}` }))
    })
  )
  await writeFile(join(claude, 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: installed }))
  await writeFile(
    join(claude, 'plugins', 'known_marketplaces.json'),
    JSON.stringify({
      'demo-plugins': {
        source: { source: 'directory', path: marketplace },
        installLocation: marketplace,
        lastUpdated: '2026-11-01T10:00:00.000Z'
      }
    })
  )
  await writeFile(
    join(claude, 'settings.json'),
    JSON.stringify({ enabledPlugins: Object.fromEntries(PLUGINS.map(([name]) => [`${name}@demo-plugins`, true])) })
  )
}

async function writeHome(home, mcpServer) {
  await writePlugins(home)
  for (const [name, description] of SKILLS) {
    for (const root of ['.claude', '.codex']) {
      const directory = join(home, root, 'skills', name)
      await mkdir(directory, { recursive: true })
      await writeFile(
        join(directory, 'SKILL.md'),
        `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\n${description}\n`
      )
    }
  }
  await writeFile(
    join(home, '.claude.json'),
    JSON.stringify({
      hasCompletedOnboarding: true,
      mcpServers: {
        docs: { type: 'stdio', command: 'node', args: [mcpServer, JSON.stringify(['search', 'fetch', 'list_pages'])] },
        tracker: { type: 'stdio', command: 'node', args: [mcpServer, JSON.stringify(['create_issue', 'update_issue'])] },
        'legacy-bridge': { type: 'stdio', command: join(home, 'missing-binary'), args: [] }
      }
    })
  )
  await mkdir(join(home, '.codex'), { recursive: true })
  await writeFile(
    join(home, '.codex', 'config.toml'),
    `[mcp_servers.docs]\ncommand = "node"\nargs = ["${mcpServer}", '${JSON.stringify(['search', 'fetch'])}']\n`
  )
}

const ago = (hours) => base - hours * HOUR

/** Чат в архиве: у проекта `archivedChats`, в сайдбаре его нет. */
const archived = (id, title, hours, agent = 'claude') => ({
  id,
  title,
  agent,
  createdAt: ago(hours + 2),
  archivedAt: ago(hours),
  hasCustomTitle: true,
  ...(agent === 'claude' && { model: 'sonnet', effort: 'medium' })
})

export async function extend(context) {
  if (!wanted()) {
    return {}
  }
  const project = (id) => context.projects.find((candidate) => candidate.id === id)
  project('p-fern').archivedChats = [
    archived('a-fern-1', 'Migrate the cart to integer cents', 30),
    archived('a-fern-2', 'Try a new empty state for orders', 52, 'codex')
  ]
  project('p-orbit').archivedChats = [archived('a-orbit-1', 'Profile the slow report export', 75)]
  const root = context.repositories
  const bin = join(root, 'bin')
  const home = join(root, 'home')
  await writeGh(bin)
  await mkdir(home, { recursive: true })
  const mcpServer = join(root, 'demo-mcp-server.cjs')
  await writeFile(mcpServer, MCP_SERVER)
  await writeHome(home, mcpServer)
  // Оболочка входа получает от приложения только HOME (ZDOTDIR не передаётся), так что
  // PATH с поддельным `gh` пишем в .zshrc домашней папки.
  await writeFile(join(home, '.zshrc'), `export PATH="${bin}:$PATH"\n`)
  return { env: { HOME: home } }
}
