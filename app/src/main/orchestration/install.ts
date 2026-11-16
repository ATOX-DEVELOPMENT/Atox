import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_SCREEN_DEVICE, SCREEN_DEVICES, SCREEN_SIZE } from '../../shared/canvas'
import { CANVAS_MESSAGE_PREFIX, SCREEN_FILE_MAX_MB } from '../canvas/rules'
import { quoteShell } from '../shellQuote'

/** Права исполняемого файла команды. */
const EXECUTABLE = 0o755

/**
 * Создаёт исполняемый файл `atox` в `binDirectory`: он запускает собранную команду бинарником
 * приложения в режиме Node, так что отдельный Node.js пользователю не нужен. Файл
 * пересоздаётся при каждом запуске: путь к приложению мог измениться после обновления.
 */
export async function installCli(
  binDirectory: string,
  executablePath: string,
  scriptPath: string
): Promise<string> {
  const cliPath = join(binDirectory, 'atox')
  const content = `#!/bin/sh
ELECTRON_RUN_AS_NODE=1 exec ${quoteShell(executablePath)} ${quoteShell(scriptPath)} "$@"
`
  await mkdir(binDirectory, { recursive: true })
  await writeFile(cliPath, content, { mode: EXECUTABLE })
  return cliPath
}

const SKILL = `---
name: atox
description: Delegate work to other coding agents (Claude Code, Codex) that run in parallel Atox chats, and talk to them. Use inside Atox (the ATOX_CHAT_ID environment variable is set) when the user asks to hand a task to another agent, run agents in parallel, or get a second opinion from Codex or Claude; also use it when you are an Atox worker that must report back.
---

# Atox agents

Inside Atox every chat is a conversation with a coding agent (Claude Code or Codex). The \`atox\` command starts another agent in a new chat in the same folder; the user sees it nested under your chat. Its report comes back to your chat as a new message starting with "[Atox] Worker".

## Commands

\`\`\`sh
atox agents                                  # installed agents; start only these
atox models claude                           # the agent's models: id, name, effort levels (* = default)
atox start claude --title "Fix checkout" "<task>"
atox start claude --model opus --effort high --title "Plan the migration" "<task>"
atox workers                                 # your workers, oldest first: id, agent and model, state, age, title
atox send <worker-chat-id> "<message>"       # follow-up or answer to a worker's question
atox remove <worker-chat-id> [...]           # stop workers and remove their chats
atox send parent "<question>"                # worker: ask the agent that started you
atox report "<summary>"                      # worker: final result, exactly once
\`\`\`

## Starting workers

- Run \`atox agents\` first. If the agent the user asked for is not installed, say so and offer the installed ones instead.
- Make each task self-contained: the files in scope, the change to make, constraints, and how to verify it. The worker sees nothing of your conversation.
- Without \`--model\`/\`--effort\` a worker gets the model the user starts new chats with. Set them when the user asks for a model or effort, or when the task clearly calls for a stronger or cheaper one. Take the ids and levels from \`atox models <agent>\`; an unknown model or effort is rejected with the list to choose from.
- Workers share the folder with you and each other, so give them separate files or areas.
- After starting, keep working or end your turn. Do not poll or wait in a loop: the report arrives as a new message. Use \`atox workers\` only when the user asks for status.
- Workers cannot start workers of their own.

## Removing workers

- Clean up after yourself: when a worker has reported and you have checked its result and need nothing more from it, remove it with \`atox remove <worker-chat-id>\` right away, without asking the user. Keep it only while you still plan to send it a follow-up.
- Also remove a worker you started by mistake, or one the user no longer needs. Removing stops the agent and deletes its chat; this cannot be undone.
- Remove a worker that is still working only when the user asks or the task was started by mistake: its unfinished work is lost.
- Take the ids from \`atox workers\`. You can remove only your own workers.

## As a worker

If your first message says you are a worker, do the task, then run \`atox report\` once with what you did, what you found, and what is left. Ask questions with \`atox send parent\`, not the user.

## Troubleshooting

- \`atox\` not found: run "$ATOX_CLI" with the same arguments.
- Blocked by a sandbox or permissions: run it again with elevated permissions; it only talks to the local Atox app.
`

/** Устройства холста с размерами — из того же списка, что проверяет команда. */
const CANVAS_DEVICES = Object.entries(SCREEN_DEVICES)
  .map(([id, { name, width, height }]) => `- \`${id}\`: ${name}, ${width}x${height}`)
  .join('\n')

const CANVAS_SKILL = `---
name: atox-canvas
description: Show UI designs to the user on the Atox canvas. Use inside Atox (the ATOX_CHAT_ID environment variable is set) when the user asks to design, draw, show, mock up, prototype or preview screens, a UI, a page, a website or an app screen, and whenever a message starts with "${CANVAS_MESSAGE_PREFIX}".
---

# Atox canvas

The canvas is a page in Atox where the user sees the screens of this chat side by side: phone app screens, website pages, desktop app windows. Each screen is one HTML file in the project. Atox watches the file, so the canvas updates by itself every time you edit it. The user moves, renames and zooms screens; you only write the HTML.

## Commands

\`\`\`sh
atox canvas                                                    # this chat's canvas: screens with device, size and file
atox canvas screen set Login .atox/canvas/login.html --device iphone
atox canvas screen set "Admin dashboard" .atox/canvas/admin.html --device web
atox canvas screen set Widget .atox/canvas/widget.html --size 360x640
atox canvas screen preview Login                               # PNG of the screen as the user sees it, plus layout problems
atox canvas screen remove Login                                # removes the screen; the file stays
\`\`\`

## Workflow

1. Write the screen as an HTML file inside the project, for example \`.atox/canvas/login.html\`.
2. Put it on the canvas once: \`atox canvas screen set Login .atox/canvas/login.html --device iphone\`. The canvas is created for this chat if it has none.
3. From then on just edit the file. Do not run \`set\` again unless the device or size changes; \`set\` with the name of an existing screen updates it and keeps its name and place.
4. One file per screen. Add several screens for a flow (Login, Home, Settings).
5. Check your own work: run \`atox canvas screen preview <name>\` after the first draft and after bigger changes, open the PNG it prints, and fix whatever looks wrong (broken layout, overlaps, unreadable text, empty areas) before you tell the user it is done.

\`set\` and \`preview\` also print "Layout problems" when the content does not fit the screen, for example "Content is 1240 px tall but the screen is 844 px: it is cut off." Fix these in the HTML: shrink the layout to the screen, or scroll inside an inner element. No output about layout means it fits.

The user, not you, names and arranges screens. If they renamed a screen, use the new name from \`atox canvas\`.

## Devices

\`--device\` (default \`${DEFAULT_SCREEN_DEVICE}\`), sizes in CSS pixels:
${CANVAS_DEVICES}

\`--size WxH\` sets a custom size without a device frame (each side ${SCREEN_SIZE.min} to ${SCREEN_SIZE.max}).

## HTML rules

- One self-contained file: inline \`<style>\` and \`<script>\`, no other files.
- No external requests: CDNs, web fonts, remote images, fetch and forms are blocked. Images only as inline SVG or \`data:\` URIs.
- Design for the exact device size: the page is shown at that width and height. Fill it, with no outer scrollbars (\`html, body { margin: 0; height: 100%; overflow: hidden }\`); scroll inside the layout if the content is long.
- System font stack: \`font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif\`.
- Realistic content: real labels, names, numbers and states, not lorem ipsum.
- Light inline JS for tabs, toggles or hover states is fine; the page runs sandboxed, without network or storage.

## "${CANVAS_MESSAGE_PREFIX} Fix the screen ..." messages

The user clicked a screen and asked for a change. The message has the request, \`File:\` with the screen's HTML file and usually \`Screenshot:\` with a PNG of how it looks now.

- Open the File, look at the Screenshot, make the change in the file. The canvas updates by itself.
- Do not run \`atox canvas screen set\` again unless the device or size must change.
- Do not ask the user for screenshots or which file: both are in the message.
- Answer in one or two lines with what you changed.

Other "${CANVAS_MESSAGE_PREFIX} ..." messages are requests about the canvas as a whole, for example a new screen.

## Troubleshooting

- \`atox\` not found: run "$ATOX_CLI" with the same arguments.
- Blocked by a sandbox or permissions: run it again with elevated permissions; it only talks to the local Atox app.
- The file must be inside the project folder, an .html file, at most ${SCREEN_FILE_MAX_MB} MB.
`

/** Навыки Atox для агентов: имя папки навыка и текст. */
const SKILLS = [
  { name: 'atox', content: SKILL },
  { name: 'atox-canvas', content: CANVAS_SKILL }
]

/** Каталоги навыков агентов: Claude Code читает свой, Codex — общий для агентов ~/.agents. */
const SKILL_TARGETS = [
  { agentHome: '.claude', skillsDirectory: ['.claude', 'skills'] },
  { agentHome: '.codex', skillsDirectory: ['.agents', 'skills'] }
]

/**
 * Устанавливает навыки Atox тем агентам, что есть у пользователя, — так агент знает, что
 * может запускать помощников и показывать экраны на холсте. Файл перезаписывается, только
 * если его текст изменился.
 */
export async function installSkills(): Promise<void> {
  const home = homedir()
  const targets = SKILL_TARGETS.filter(({ agentHome }) => existsSync(join(home, agentHome)))
  await Promise.all(
    targets.flatMap(({ skillsDirectory }) =>
      SKILLS.map(async ({ name, content }) => {
        const directory = join(home, ...skillsDirectory, name)
        const file = join(directory, 'SKILL.md')
        const current = await readFile(file, 'utf8').catch(() => null)
        if (current !== content) {
          await mkdir(directory, { recursive: true })
          await writeFile(file, content)
        }
      })
    )
  )
}

/**
 * Правило Codex: `atox` запускается без вопроса и вне песочницы — иначе песочница не даёт
 * подключиться к сокету приложения, и каждую команду помощника пришлось бы одобрять вручную.
 * Codex читает все файлы правил из ~/.codex/rules.
 */
const CODEX_RULES = `prefix_rule(pattern=["atox"], decision="allow")
`

export async function installCodexRules(): Promise<void> {
  const codexHome = join(homedir(), '.codex')
  if (!existsSync(codexHome)) {
    return
  }
  const directory = join(codexHome, 'rules')
  const file = join(directory, 'atox.rules')
  if ((await readFile(file, 'utf8').catch(() => null)) !== CODEX_RULES) {
    await mkdir(directory, { recursive: true })
    await writeFile(file, CODEX_RULES)
  }
}
