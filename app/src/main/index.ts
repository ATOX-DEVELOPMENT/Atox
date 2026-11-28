import { tmpdir, userInfo } from 'node:os'
import { basename, delimiter, join } from 'node:path'
import { app, BrowserWindow, nativeTheme, net, protocol, shell as electronShell } from 'electron'
import { AccountService } from './accounts/service'
import { AgentCliService } from './agentCli'
import { AgentDetector } from './agents'
import { WorkingTreeReader } from './changes'
import { ProjectFiles } from './projectFiles'
import { claudeDriver } from './conversations/claude'
import { limitsKey } from '../shared/accounts'
import { createCodexDriver } from './conversations/codex'
import { ConversationManager } from './conversations/manager'
import { TranscriptStore } from './conversations/transcripts'
import { installDesktopEntry } from './desktopEntry'
import { GitBranchTracker } from './gitBranches'
import {
  CANVAS_KIT_DIRECTORY,
  CANVAS_VENDOR_DIRECTORY
} from '../shared/canvasRuntime'
import { handleImageProtocol, IMAGE_SCHEME } from './imageProtocol'
import { CANVAS_SCHEME, handleCanvasProtocol } from './canvas/protocol'
import { canvasResourcePath } from './canvas/resources'
import { CanvasService } from './canvas/service'
import {
  broadcastAccounts,
  broadcastAgentCli,
  broadcastBoard,
  broadcastCanvas,
  broadcastGitBranches,
  broadcastConversationEvent,
  broadcastAgentListsStale,
  broadcastPlanLimits,
  broadcastTokenSpend,
  broadcastProjectsChanged,
  broadcastTerminalData,
  broadcastTerminalExit,
  broadcastUpdateState,
  registerIpcHandlers
} from './ipc'
import { AppMenu } from './menu'
import { installCli, installCodexRules, installSkills } from './orchestration/install'
import { OrchestrationServer } from './orchestration/server'
import { PlanLimitsMonitor } from './planLimits'
import { TokenSpendLedger } from './tokenSpend'
import { setupQuitHandling } from './quit'
import { BoardGitHub } from './board/github'
import { BoardService } from './board/service'
import { BoardWorktrees } from './board/worktrees'
import { GitHubAccounts } from './githubAccounts'
import { ChatPullRequests } from './chatPullRequests'
import { LinkPreviews } from './linkPreviews'
import { RepositoryReader } from './repository'
import { SettingsStore } from './settings'
import { ShellEnvironment } from './shellEnvironment'
import { EXTERNAL_LINK_PROTOCOLS } from '../shared/links'
import { ProjectStore } from './store'
import { TerminalManager } from './terminals'
import { checkForUpdatesFromMenu } from './updateCheck'
import { createUpdateInstaller } from './updateInstallers'
import { AppUpdater } from './updater'
import { UsageStats } from './usageStats'
import { APP_FRAME_SOURCE, createMainWindow, setWindowSurface } from './window'

const STORE_FILE_NAME = 'projects.json'
const SETTINGS_FILE_NAME = 'settings.json'
const BOARD_FILE_NAME = 'board.json'
const CANVAS_FILE_NAME = 'canvases.json'
/** Каталог снимков версий экранов холстов. */
const CANVAS_HISTORY_DIRECTORY_NAME = 'canvas-history'
const USAGE_STATS_FILE_NAME = 'usage-stats.json'
const TOKEN_SPEND_FILE_NAME = 'token-spend.json'
const PLAN_LIMITS_FILE_NAME = 'plan-limits.json'
const PLAN_LIMITS_LOG_NAME = 'plan-limits.log'
const ACCOUNTS_FILE_NAME = 'accounts.json'
/** Через сколько после запуска узнавать аккаунты агентов: сначала должно открыться окно. */
const ACCOUNTS_STARTUP_DELAY_MS = 3_000
/** Каталог дополнительных аккаунтов агентов: у каждого своя папка. */
const ACCOUNTS_DIRECTORY_NAME = 'accounts'
/** Каталог с лентами чатов: у каждого чата свой файл. */
const TRANSCRIPTS_DIRECTORY_NAME = 'conversations'

/** Собранная команда `atox` для агентов — рядом с main-процессом. */
const CLI_SCRIPT = join('out', 'main', 'atox.js')

/** Путь к AppImage, если приложение запущено из него: его задаёт среда запуска AppImage. */
const appImage = process.env['APPIMAGE']

/** Только в разработке: каталоги с подставными программами агентов, которые встают в начало PATH. */
const DEV_AGENT_PATH_VARIABLE = 'ATOX_DEV_AGENT_PATH'

/** Сборка для разработки хранит данные отдельно и не трогает проекты установленного приложения. */
const DEV_USER_DATA_SUFFIX = '-dev'

if (!app.isPackaged) {
  app.setPath('userData', app.getPath('userData') + DEV_USER_DATA_SUFFIX)
}

/**
 * Второй экземпляр перехватил бы сокет команды `atox` у агентов первого и писал бы
 * в те же файлы данных. Поэтому повторный запуск только показывает окно уже открытого.
 */
const isPrimaryInstance = app.requestSingleInstanceLock()

// Схемы объявляются до готовности приложения и одним вызовом: следующий вызов отменил бы прежний.
protocol.registerSchemesAsPrivileged([IMAGE_SCHEME, CANVAS_SCHEME])

async function bootstrap(): Promise<void> {
  await app.whenReady()
  handleImageProtocol()

  const userData = app.getPath('userData')
  const store = await ProjectStore.load(join(userData, STORE_FILE_NAME))
  const settings = await SettingsStore.load(join(userData, SETTINGS_FILE_NAME))
  // Тема окна: `prefers-color-scheme` в окне и цвет фона окна следуют за ней.
  nativeTheme.themeSource = settings.get().theme
  setWindowSurface(settings.get().surface)
  settings.onChange(({ theme, surface }) => {
    nativeTheme.themeSource = theme
    setWindowSurface(surface)
  })
  // Системная тема сменилась: фон окна под отрисовкой — тоже.
  nativeTheme.on('updated', () => setWindowSurface(settings.get().surface))
  const tokenSpend = await TokenSpendLedger.load(join(userData, TOKEN_SPEND_FILE_NAME))
  tokenSpend.onChange(broadcastTokenSpend)
  const transcripts = await TranscriptStore.open(join(userData, TRANSCRIPTS_DIRECTORY_NAME))
  const binDirectory = join(userData, 'bin')
  const cliPath = await installCli(
    binDirectory,
    process.execPath,
    join(app.getAppPath(), CLI_SCRIPT)
  )
  // Только в разработке: каталоги с подставными программами агентов встают в начало PATH, чтобы
  // проверять обновление агентов, не трогая настоящие.
  const shell = new ShellEnvironment(
    app.isPackaged ? null : (process.env[DEV_AGENT_PATH_VARIABLE] ?? null)
  )
  const agents = new AgentDetector(shell)
  // Агенты получают окружение оболочки входа пользователя, а команду `atox` находят по PATH.
  const githubAccounts = new GitHubAccounts(shell)
  // Доска загружается после разговоров, но узнаёт от них, когда агент задачи закончил ход.
  let board: BoardService | undefined
  const agentEnvironment = async (chatId?: string): Promise<Record<string, string>> => {
    const environment = await shell.get()
    // Агент задачи с доски ходит на GitHub под учётной записью, через которую видна задача, —
    // `gh` и git берут её токен из `GH_TOKEN`, не трогая активную учётную запись пользователя.
    const account = chatId ? store.findChat(chatId)?.chat.githubAccount : undefined
    const token = account ? await githubAccounts.token(account) : null
    return {
      ...environment,
      PATH: [binDirectory, environment['PATH']].filter(Boolean).join(delimiter),
      ...(token && { GH_TOKEN: token }),
      ...(chatId && orchestration.environment(chatId))
    }
  }
  const drivers = {
    claude: claudeDriver,
    codex: createCodexDriver({
      name: 'atox',
      title: app.getName(),
      version: app.getVersion()
    })
  }
  const openLink = (url: string): void => {
    if (URL.canParse(url) && EXTERNAL_LINK_PROTOCOLS.has(new URL(url).protocol)) {
      void electronShell.openExternal(url)
    }
  }
  const accounts = await AccountService.load(
    {
      drivers,
      agents,
      environment: () => shell.get(),
      openLink,
      onChange: broadcastAccounts,
      onRemoving: (agent, accountId) => {
        conversations.detachAccount(accountId)
        planLimits.forget(limitsKey(agent, accountId))
      },
      onSignedIn: (agent) => conversations.accountSignedIn(agent)
    },
    join(userData, ACCOUNTS_FILE_NAME),
    join(userData, ACCOUNTS_DIRECTORY_NAME)
  )
  const conversations = new ConversationManager({
    isOnline: () => net.isOnline(),
    store,
    agents,
    drivers,
    accounts,
    transcripts,
    environment: agentEnvironment,
    onEvent: (event) => {
      broadcastConversationEvent(event)
      board?.onConversationEvent(event)
    },
    onPlanLimits: (key, limits) => planLimits.report(key, limits),
    onTokensSpent: (agent, counts) => tokenSpend.record(agent, counts),
    onProjectsChanged: () => broadcastProjectsChanged(store.list()),
    openLink,
    onAgentListsStale: broadcastAgentListsStale,
    onAccountChanged: () => void planLimits.refreshAll()
  })
  const canvas = await CanvasService.load(
    {
      store,
      conversations,
      kitDirectory: canvasResourcePath(CANVAS_KIT_DIRECTORY),
      onChange: broadcastCanvas
    },
    join(userData, CANVAS_FILE_NAME),
    join(userData, CANVAS_HISTORY_DIRECTORY_NAME)
  )
  handleCanvasProtocol(canvas, APP_FRAME_SOURCE, canvasResourcePath(CANVAS_VENDOR_DIRECTORY))
  app.on('will-quit', () => canvas.dispose())
  const planLimits = await PlanLimitsMonitor.load(
    {
      targets: async () =>
        (await agents.list()).flatMap((agent) => [
          { key: limitsKey(agent), agent },
          // Лимиты дополнительных аккаунтов читаются, только пока агент в них вошёл.
          ...accounts.signedInExtras(agent).map((account) => ({
            key: limitsKey(agent, account),
            agent,
            account
          }))
        ]),
      read: ({ agent, account }) => conversations.planLimits(agent, account),
      onChange: broadcastPlanLimits
    },
    join(userData, PLAN_LIMITS_FILE_NAME),
    join(userData, PLAN_LIMITS_LOG_NAME)
  )
  const terminals = new TerminalManager(app.getName(), {
    onData: broadcastTerminalData,
    onExit: broadcastTerminalExit
  })
  const branches = new GitBranchTracker(broadcastGitBranches)
  // Обновляется только собранное приложение; адрес релизов можно подменить для проверки обновлений.
  // Сборку для разработчика не обновляем никогда: без проверок, загрузок и установки при выходе.
  const updateInstaller = app.isPackaged && !__DEV_BUILD__ ? createUpdateInstaller() : null
  if (__DEV_BUILD__) {
    app.setAboutPanelOptions({
      applicationVersion: `${app.getVersion()} · Dev build (${__BUILD_BRANCH__} @ ${__BUILD_COMMIT__})`
    })
  }
  const updateFeedOverride = process.env['ATOX_UPDATE_FEED_URL']
  const updater = updateInstaller
    ? new AppUpdater({
        feedUrl: updateFeedOverride ?? __UPDATE_FEED_URL__,
        // В подменённом источнике файлы лежат рядом с описанием версии.
        fileUrl: (version, name) =>
          updateFeedOverride
            ? `${updateFeedOverride}/${name}`
            : `${__RELEASE_DOWNLOAD_URL__}/v${version}/${name}`,
        installer: updateInstaller,
        onStateChange: broadcastUpdateState
      })
    : null
  const orchestration = new OrchestrationServer({
    store,
    conversations,
    agents,
    canvas,
    // Путь к сокету ограничен ~100 символами, поэтому он во временном каталоге пользователя,
    // а не в длинном пути данных приложения. Имя различает сборку для разработки. На Windows
    // вместо сокета — именованный канал, у каждого пользователя свой.
    socketPath:
      process.platform === 'win32'
        ? `\\\\.\\pipe\\${basename(userData)}-${userInfo().username}`
        : join(tmpdir(), `${basename(userData)}.sock`),
    cliPath,
    modelSelection: (agent) => settings.get().agentModels[agent] ?? {},
    onProjectsChanged: () => broadcastProjectsChanged(store.list())
  })
  // Без сервера приложение работает как раньше, только команда `atox` сообщит, что Atox недоступен.
  await orchestration
    .start()
    .catch((error) => console.error('Failed to start orchestration', error))
  app.on('will-quit', () => orchestration.stop())
  void installSkills(canvasResourcePath(CANVAS_KIT_DIRECTORY)).catch((error) =>
    console.error('Failed to install agent skills', error)
  )
  void installCodexRules().catch((error) => console.error('Failed to install Codex rules', error))
  if (app.isPackaged && appImage) {
    void installDesktopEntry(appImage).catch((error) =>
      console.error('Failed to install the desktop entry', error)
    )
  }
  const menu = new AppMenu(
    settings,
    updater ? () => void checkForUpdatesFromMenu(updater) : undefined
  )
  board = await BoardService.load(
    {
      github: new BoardGitHub(githubAccounts),
      worktrees: new BoardWorktrees(shell),
      accounts: githubAccounts,
      store,
      settings,
      conversations,
      agents,
      onChange: broadcastBoard,
      onProjectsChanged: () => broadcastProjectsChanged(store.list())
    },
    join(userData, BOARD_FILE_NAME)
  )
  settings.onChange(() => board?.onSettingsChanged())
  const repository = new RepositoryReader(shell, githubAccounts)
  const agentCli = new AgentCliService(agents, shell, {
    onChange: broadcastAgentCli,
    // Новая версия агента знает другие модели и команды, а сессии идут со старой: как после входа.
    onChanged: (agent) => conversations.accountSignedIn(agent)
  })
  app.on('will-quit', () => agentCli.close())
  registerIpcHandlers({
    store,
    settings,
    conversations,
    terminals,
    branches,
    repository,
    chatPullRequests: new ChatPullRequests(shell, repository),
    linkPreviews: new LinkPreviews(shell, githubAccounts),
    githubAccounts,
    board,
    workingTree: new WorkingTreeReader(shell),
    projectFiles: new ProjectFiles(shell),
    updater,
    agents,
    agentCli,
    menu,
    planLimits,
    accounts,
    tokenSpend,
    canvas
  })
  // Ветку могли сменить или создать репозиторий в другом приложении, пока окно было не в фокусе.
  app.on('browser-window-focus', () => void branches.refreshOnFocus())
  // Пока окно было не в фокусе, в терминале могли поставить программу или поправить профиль.
  app.on('browser-window-focus', () => shell.refreshOnFocus())
  app.on('will-quit', () => branches.dispose())
  // В какие аккаунты вошли агенты, узнаём в фоне и не сразу: это запускает их процессы, а окну
  // сначала нужно открыться. Лимиты дополнительных аккаунтов читаются, когда это известно.
  setTimeout(() => {
    void accounts
      .refresh()
      .then(() => planLimits.refreshStale())
      .catch((error) => console.error('Failed to read the agent accounts', error))
  }, ACCOUNTS_STARTUP_DELAY_MS)
  // Лимиты тратятся и в других программах агентов: вернувшись в окно, пользователь видит свежие.
  planLimits.start()
  app.on('browser-window-focus', () => void planLimits.refreshStale())
  app.on('will-quit', () => planLimits.stop())
  menu.install()

  // Статистика не должна мешать запуску: без неё приложение работает как обычно.
  // Dev-сборки не шлют статистику, чтобы не смешивать свои запуски с настоящими пользователями;
  // проверить отправку можно, задав адрес в ATOX_USAGE_STATS_URL.
  const usageStatsEndpoint =
    process.env['ATOX_USAGE_STATS_URL'] ?? (app.isPackaged ? __USAGE_STATS_URL__ : null)
  const usageStats = usageStatsEndpoint
    ? await UsageStats.load({
        endpoint: usageStatsEndpoint,
        filePath: join(userData, USAGE_STATS_FILE_NAME),
        settings
      }).catch((error) => {
        console.error('Failed to load usage stats', error)
        return null
      })
    : null
  usageStats?.start()
  app.on('will-quit', () => usageStats?.stop())

  const quitHandling = setupQuitHandling({
    conversations,
    terminals,
    stores: usageStats
      ? [store, settings, conversations, board, canvas, tokenSpend, planLimits, accounts, usageStats]
      : [store, settings, conversations, board, canvas, tokenSpend, planLimits, accounts]
  })
  if (updater) {
    quitHandling.onQuitCancelled(() => updater.cancelRelaunch())
    app.on('will-quit', () => updater.installOnQuit())
    app.on('browser-window-focus', () => updater.checkOnFocus())
    updater.start()
  }

  createMainWindow()

  // На macOS приложение живёт без окон: клик по иконке в доке открывает окно заново.
  app.on('activate', showMainWindow)
  app.on('second-instance', showMainWindow)
  // Выход отменили, когда окон уже не было (закрыли последнее, пока работал агент): без окна
  // приложение на Linux осталось бы работать, но вернуться в него было бы нельзя.
  quitHandling.onQuitCancelled(() => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
}

/** Показывает окно приложения, а если его нет — открывает новое. */
function showMainWindow(): void {
  const [window] = BrowserWindow.getAllWindows()
  if (!window) {
    createMainWindow()
    return
  }
  if (window.isMinimized()) {
    window.restore()
  }
  window.show()
  window.focus()
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

if (isPrimaryInstance) {
  bootstrap().catch((error) => {
    console.error('Failed to start the app', error)
    app.quit()
  })
} else {
  app.quit()
}
