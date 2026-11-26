import { basename } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { IpcChannel, type GitBranches, type TerminalSize } from '../shared/api'
import {
  isChatCommand,
  type ChatConfiguration,
  type ConversationEvent,
  type InputValue,
  type RequestAnswer
} from '../shared/conversation'
import { archivedChats, chatGroup } from '../shared/chats'
import { isIntegrationKind } from '../shared/integrations'
import type { Project } from '../shared/models'
import type { AgentAccount } from '../shared/accounts'
import type { PlanLimitsState } from '../shared/planLimits'
import type { TokenSpendSummary } from '../shared/tokenSpend'
import { isProjectColor } from '../shared/projectColors'
import { isProjectIcon } from '../shared/projectIcons'
import { isBoardColumn, parseTaskAgent, type BoardState, type TaskStart } from '../shared/board'
import { isCanvasExportFormat, type CanvasState } from '../shared/canvas'
import type { GitHubCounts, GitHubKind, ListState } from '../shared/repository'
import type { Settings } from '../shared/settings'
import type { UpdateState } from '../shared/update'
import { findAgent, isAgentId, type AgentId } from '../shared/agents'
import type { AgentDetector } from './agents'
import type { WorkingTreeReader } from './changes'
import type { ProjectFiles } from './projectFiles'
import type { ConversationManager } from './conversations/manager'
import { chooseExportTarget, confirm, describeWorkingAgents, inform } from './dialogs'
import type { GitBranchTracker } from './gitBranches'
import type { SettingsStore } from './settings'
import type { ProjectStore } from './store'
import type { AppMenu } from './menu'
import type { AccountService } from './accounts/service'
import type { PlanLimitsMonitor } from './planLimits'
import type { TokenSpendLedger } from './tokenSpend'
import { openFileLink } from './fileLinks'
import { readImage, saveImageAs } from './images'
import { savePastedImage } from './pastedImages'
import { pickFiles } from './pickedFiles'
import type { BoardService } from './board/service'
import type { CanvasService } from './canvas/service'
import type { GitHubAccounts } from './githubAccounts'
import type { RepositoryReader } from './repository'
import type { ChatPullRequests } from './chatPullRequests'
import type { LinkPreviews } from './linkPreviews'
import { getUserProfile } from './system'
import type { TerminalManager } from './terminals'
import type { AppUpdater } from './updater'

interface AppServices {
  store: ProjectStore
  settings: SettingsStore
  conversations: ConversationManager
  terminals: TerminalManager
  branches: GitBranchTracker
  repository: RepositoryReader
  chatPullRequests: ChatPullRequests
  linkPreviews: LinkPreviews
  workingTree: WorkingTreeReader
  projectFiles: ProjectFiles
  agents: AgentDetector
  /** `null` — обновления недоступны, например при запуске из исходников. */
  updater: AppUpdater | null
  menu: AppMenu
  planLimits: PlanLimitsMonitor
  accounts: AccountService
  tokenSpend: TokenSpendLedger
  githubAccounts: GitHubAccounts
  board: BoardService
  canvas: CanvasService
}

export function registerIpcHandlers({
  store,
  settings,
  conversations,
  terminals,
  branches,
  projectFiles,
  repository,
  chatPullRequests,
  linkPreviews,
  workingTree,
  agents,
  updater,
  menu,
  planLimits,
  accounts,
  tokenSpend,
  githubAccounts,
  board,
  canvas
}: AppServices): void {
  const trackProjectBranches = () => void branches.track(store.list().map(({ path }) => path))
  trackProjectBranches()

  ipcMain.handle(IpcChannel.ProjectsList, () => store.list())

  ipcMain.handle(IpcChannel.ProjectsAdd, async (event, spaceId: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Open Project',
      buttonLabel: 'Open',
      properties: ['openDirectory', 'createDirectory']
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)

    const [path] = result.filePaths
    if (result.canceled || !path) {
      return null
    }
    const project = store.addProject(path, spaceId)
    trackProjectBranches()
    return { projects: store.list(), projectId: project.id }
  })

  ipcMain.handle(IpcChannel.ProjectsRemove, async (event, projectId: string) => {
    const project = store.getProject(projectId)
    const working = project.chats.filter((chat) => conversations.isRunning(chat.id))
    const confirmed =
      working.length === 0 ||
      (await confirm(BrowserWindow.fromWebContents(event.sender), {
        message: `Remove “${project.name}” from the list?`,
        detail: `${describeWorkingAgents(working.length, 'in this project', 'Removing the project')} The folder stays on disk.`,
        confirmLabel: 'Remove'
      }))
    if (confirmed) {
      store.removeProject(projectId)
      terminals.kill(projectId)
      await canvas.removeProject(projectId)
      // История чатов из архива удаляется вместе с проектом.
      const chats = [...project.chats, ...archivedChats(project)]
      await Promise.all(chats.map((chat) => conversations.remove(chat.id)))
      trackProjectBranches()
    }
    return store.list()
  })

  ipcMain.handle(IpcChannel.ProjectsMoveToSpace, (_event, projectId: string, spaceId: string) => {
    store.moveProjectToSpace(projectId, spaceId)
    return store.list()
  })

  ipcMain.handle(IpcChannel.SpacesList, () => store.listSpaces())

  ipcMain.handle(IpcChannel.SpacesCreate, () => {
    store.createSpace()
    return store.listSpaces()
  })

  ipcMain.handle(IpcChannel.SpacesRename, (_event, spaceId: string, name: string) => {
    store.renameSpace(spaceId, name)
    return store.listSpaces()
  })

  ipcMain.handle(IpcChannel.SpacesSetColor, (_event, spaceId: string, color: unknown) => {
    store.setSpaceColor(spaceId, isProjectColor(color) ? color : null)
    return store.listSpaces()
  })

  ipcMain.handle(IpcChannel.SpacesSetActive, (_event, spaceId: string) => {
    store.setActiveSpace(spaceId)
    return store.listSpaces()
  })


  ipcMain.handle(IpcChannel.SpacesRemove, async (event, spaceId: string) => {
    const space = store.findSpace(spaceId)
    const heir = store.findSpaceHeir(spaceId)
    if (!space || !heir) {
      return null
    }
    const projectCount = store.list().filter((project) => project.spaceId === spaceId).length
    // Проекты не пропадают, а переезжают — но о переезде лучше спросить заранее.
    const confirmed =
      projectCount === 0 ||
      (await confirm(BrowserWindow.fromWebContents(event.sender), {
        message: `Delete “${space.name}”?`,
        detail: `Its ${projectCount === 1 ? 'project moves' : `${projectCount} projects move`} to “${heir.name}” with all chats.`,
        confirmLabel: 'Delete'
      }))
    if (!confirmed) {
      return null
    }
    store.removeSpace(spaceId)
    return { spaces: store.listSpaces(), projects: store.list() }
  })

  ipcMain.handle(IpcChannel.ProjectsRename, (_event, projectId: string, name: string) => {
    store.renameProject(projectId, name)
    return store.list()
  })

  ipcMain.handle(IpcChannel.ProjectsSetColor, (_event, projectId: string, color: unknown) => {
    store.setProjectColor(projectId, isProjectColor(color) ? color : null)
    return store.list()
  })

  ipcMain.handle(IpcChannel.ProjectsSetIcon, (_event, projectId: string, icon: unknown) => {
    store.setProjectIcon(projectId, isProjectIcon(icon) ? icon : null)
    return store.list()
  })

  ipcMain.handle(IpcChannel.ProjectsSetSplit, (_event, projectId: string, chatIds: unknown) => {
    store.setProjectSplit(projectId, Array.isArray(chatIds) ? chatIds.map(String) : null)
    return store.list()
  })

  ipcMain.handle(
    IpcChannel.ProjectsSetSplitPosition,
    (_event, projectId: string, position: number) => {
      store.setProjectSplitPosition(projectId, Number(position))
      return store.list()
    }
  )

  ipcMain.handle(IpcChannel.ProjectsMove, (_event, projectId: string, toIndex: number) => {
    store.moveProject(projectId, toIndex)
    return store.list()
  })

  ipcMain.handle(IpcChannel.ProjectsReveal, async (_event, projectId: string) => {
    const error = await shell.openPath(store.getProject(projectId).path)
    if (error) {
      throw new Error(error)
    }
  })

  ipcMain.handle(IpcChannel.AgentsAvailable, () => agents.list())
  ipcMain.handle(IpcChannel.AgentsCatalog, (_event, agent: unknown) =>
    isAgentId(agent) ? conversations.catalog(agent) : null
  )
  ipcMain.handle(
    IpcChannel.AgentsIntegrations,
    (_event, agent: unknown, kind: unknown, projectId: unknown) => {
      if (!isAgentId(agent) || !isIntegrationKind(kind)) {
        throw new Error('Unknown agent or list')
      }
      return conversations.integrations(
        agent,
        kind,
        typeof projectId === 'string' ? projectId : null
      )
    }
  )

  /** Агент по умолчанию, если он установлен, иначе первый установленный. */
  const resolveDefaultAgent = async (): Promise<AgentId> => {
    const { defaultAgent } = settings.get()
    const installed = await agents.list()
    return installed.includes(defaultAgent) ? defaultAgent : (installed[0] ?? defaultAgent)
  }

  ipcMain.handle(IpcChannel.ChatsCreate, async (_event, projectId: string, agent?: unknown) => {
    // Агента выбрали явно — он становится агентом по умолчанию для следующих чатов.
    if (isAgentId(agent) && agent !== settings.get().defaultAgent) {
      settings.update({ defaultAgent: agent })
    }
    const chosen = isAgentId(agent) ? agent : await resolveDefaultAgent()
    const chat = store.createChat(projectId, chosen, settings.get().agentModels[chosen])
    return { projects: store.list(), chatId: chat.id }
  })

  ipcMain.handle(IpcChannel.ChatsFork, async (_event, chatId: string) => {
    const { chat } = await conversations.fork(chatId)
    return { projects: store.list(), chatId: chat.id }
  })

  ipcMain.handle(IpcChannel.ChatsRemove, async (event, chatId: string) => {
    const location = store.findChat(chatId)
    const confirmed =
      !location ||
      !conversations.isRunning(chatId) ||
      (await confirm(BrowserWindow.fromWebContents(event.sender), {
        message: `Delete “${location.chat.title}”?`,
        detail: describeWorkingAgents(
          1,
          'in this chat',
          'Deleting the chat',
          findAgent(location.chat.agent)?.name
        ),
        confirmLabel: 'Delete'
      }))
    if (confirmed) {
      store.removeChat(chatId)
      await conversations.remove(chatId)
    }
    return store.list()
  })

  ipcMain.handle(IpcChannel.ChatsArchive, async (event, chatId: string) => {
    const location = store.findChat(chatId)
    const working = location
      ? chatGroup(location.project.chats, chatId).filter((chat) => conversations.isRunning(chat.id))
      : []
    const confirmed =
      !location ||
      working.length === 0 ||
      (await confirm(BrowserWindow.fromWebContents(event.sender), {
        message: `Archive “${location.chat.title}”?`,
        detail: describeWorkingAgents(
          working.length,
          'in this chat',
          'Archiving the chat',
          findAgent(working[0]!.agent)?.name
        ),
        confirmLabel: 'Archive'
      }))
    if (confirmed) {
      // Агенты останавливаются, а история остаётся на диске — чат можно будет вернуть.
      const archived = store.archiveChat(chatId)
      await Promise.all(archived.map((chat) => conversations.close(chat.id)))
    }
    return store.list()
  })

  ipcMain.handle(IpcChannel.ChatsRestore, (_event, chatId: string) => {
    store.restoreChat(chatId)
    return store.list()
  })

  ipcMain.handle(IpcChannel.ChatsRemoveArchived, async (event, chatId: string) => {
    const location = store.findArchivedChat(chatId)
    // Удаление из архива необратимо: спрашиваем всегда, а не только когда агент работает.
    const confirmed =
      location &&
      (await confirm(BrowserWindow.fromWebContents(event.sender), {
        message: `Delete “${location.chat.title}”?`,
        detail: 'The chat and its history will be deleted. This can’t be undone.',
        confirmLabel: 'Delete'
      }))
    if (confirmed) {
      store.removeArchivedChat(chatId)
      await conversations.remove(chatId)
    }
    return store.list()
  })

  ipcMain.handle(IpcChannel.ChatsRename, (_event, chatId: string, title: string) => {
    store.renameChat(chatId, title)
    return store.list()
  })

  ipcMain.handle(IpcChannel.ChatsMove, (_event, chatId: string, toIndex: number) => {
    store.moveChat(chatId, toIndex)
    return store.list()
  })

  ipcMain.handle(
    IpcChannel.ChatsConfigure,
    async (_event, chatId: string, configuration: unknown) => {
      await conversations.configure(chatId, parseConfiguration(configuration))
      const chat = store.findChat(chatId)?.chat
      if (chat) {
        // Модель и эффорт агента запоминаются для следующих чатов; агент по умолчанию —
        // нет: смена агента касается только этого чата.
        const { agentModels } = settings.get()
        const selection = {
          ...(chat.model && { model: chat.model }),
          ...(chat.effort && { effort: chat.effort })
        }
        if (JSON.stringify(agentModels[chat.agent] ?? {}) !== JSON.stringify(selection)) {
          settings.update({
            agentModels: { ...agentModels, [chat.agent]: selection }
          })
        }
      }
      return store.list()
    }
  )

  ipcMain.handle(IpcChannel.ConversationsSummaries, () => conversations.summaries())

  ipcMain.handle(IpcChannel.ConversationsSnapshot, (_event, chatId: string) =>
    conversations.snapshot(chatId)
  )
  ipcMain.handle(
    IpcChannel.ConversationsSend,
    (_event, chatId: string, text: unknown, attachments: unknown) => {
      const record = typeof attachments === 'object' && attachments !== null ? attachments : {}
      return conversations.send(chatId, String(text), {
        images: 'images' in record ? stringList(record.images) : [],
        files: 'files' in record ? stringList(record.files) : []
      })
    }
  )
  ipcMain.handle(IpcChannel.ConversationsCommands, (_event, chatId: string) =>
    conversations.commands(chatId)
  )
  ipcMain.handle(IpcChannel.ConversationsRunCommand, (_event, chatId: string, command: unknown) => {
    if (!isChatCommand(command)) {
      throw new Error(`Unknown command: ${String(command)}`)
    }
    return conversations.runCommand(chatId, command)
  })
  ipcMain.handle(IpcChannel.ConversationsContext, (_event, chatId: string) =>
    conversations.context(chatId)
  )
  ipcMain.handle(IpcChannel.ConversationsInterrupt, (_event, chatId: string) =>
    conversations.interrupt(chatId)
  )
  ipcMain.handle(IpcChannel.ConversationsCancelQueued, (_event, chatId: string, itemId: unknown) =>
    conversations.cancelQueued(chatId, String(itemId))
  )
  ipcMain.handle(IpcChannel.ConversationsSendQueuedNow, (_event, chatId: string, itemId: unknown) =>
    conversations.sendQueuedNow(chatId, String(itemId))
  )
  ipcMain.handle(
    IpcChannel.ConversationsEditQueued,
    (_event, chatId: string, itemId: unknown, text: unknown) =>
      conversations.editQueued(chatId, String(itemId), String(text))
  )
  ipcMain.handle(IpcChannel.ConversationsReorderQueued, (_event, chatId: string, itemIds: unknown) =>
    conversations.reorderQueued(chatId, Array.isArray(itemIds) ? itemIds.map(String) : [])
  )
  ipcMain.handle(
    IpcChannel.ConversationsAnswerRequest,
    (_event, chatId: string, itemId: unknown, answer: unknown) =>
      conversations.answerRequest(chatId, String(itemId), parseRequestAnswer(answer))
  )

  ipcMain.handle(IpcChannel.TerminalsAttach, (_event, projectId: string, size: unknown) =>
    terminals.attach(projectId, store.getProject(projectId).path, parseTerminalSize(size))
  )
  ipcMain.on(IpcChannel.TerminalsWrite, (_event, projectId: string, data: unknown) => {
    if (typeof data === 'string') {
      terminals.write(projectId, data)
    }
  })
  ipcMain.on(IpcChannel.TerminalsResize, (_event, projectId: string, size: unknown) =>
    terminals.resize(projectId, parseTerminalSize(size))
  )

  ipcMain.handle(IpcChannel.FilesPick, (event) =>
    pickFiles(BrowserWindow.fromWebContents(event.sender))
  )
  ipcMain.handle(IpcChannel.FilesSavePastedImage, (_event, data: ArrayBuffer, type: string) =>
    savePastedImage(data, type)
  )
  ipcMain.handle(IpcChannel.FilesOpen, (_event, path: unknown, baseDirectory: unknown) =>
    openFileLink(String(path), typeof baseDirectory === 'string' ? baseDirectory : undefined)
  )

  ipcMain.handle(IpcChannel.ImagesRead, (_event, path: string) => readImage(path))
  ipcMain.handle(IpcChannel.ImagesSaveAs, (event, path: string) =>
    saveImageAs(BrowserWindow.fromWebContents(event.sender), path)
  )

  ipcMain.handle(IpcChannel.GitBranches, () => branches.list())

  ipcMain.handle(IpcChannel.ProjectFilesList, (_event, projectId: string) =>
    projectFiles.list(store.getProject(projectId).path)
  )
  ipcMain.handle(IpcChannel.ProjectFilesRead, (_event, projectId: string, path: unknown) =>
    projectFiles.read(store.getProject(projectId).path, String(path))
  )
  ipcMain.handle(IpcChannel.ChangesList, (_event, projectId: string) =>
    workingTree.list(store.getProject(projectId).path)
  )
  ipcMain.handle(IpcChannel.ChangesDiff, (_event, projectId: string, path: string) =>
    workingTree.diff(store.getProject(projectId).path, path)
  )
  ipcMain.handle(IpcChannel.ChangesDiscard, async (event, projectId: string, path: string) => {
    const projectPath = store.getProject(projectId).path
    // Путь сверяется со списком изменений: окно не может откатить произвольный файл.
    const change = await workingTree.find(projectPath, path)
    if (!change) {
      return false
    }
    const created = change.kind === 'untracked' || change.kind === 'added'
    const confirmed = await confirm(BrowserWindow.fromWebContents(event.sender), {
      message: `Discard changes to “${basename(change.path)}”?`,
      detail: created
        ? 'The new file will be moved to the Trash.'
        : 'The file will go back to the last commit. Changes in it will be lost.',
      confirmLabel: 'Discard'
    })
    if (confirmed) {
      await workingTree.discard(projectPath, change)
    }
    return confirmed
  })

  ipcMain.handle(IpcChannel.RepositoryGitHub, (_event, projectId: string, loaded?: GitHubCounts) =>
    repository.github(store.getProject(projectId).path, loaded)
  )
  ipcMain.handle(
    IpcChannel.RepositoryMoreGitHub,
    (_event, projectId: string, kind: GitHubKind, state: ListState, cursor: string) =>
      repository.moreGitHub(store.getProject(projectId).path, kind, state, cursor)
  )
  ipcMain.handle(IpcChannel.LinksPreview, (_event, url: string, chatId?: string) =>
    linkPreviews.preview(url, chatId ? store.findChat(chatId)?.chat.githubAccount : undefined)
  )
  ipcMain.handle(IpcChannel.RepositoryChatPullRequest, (_event, chatId: string, fresh?: boolean) => {
    const location = store.findChat(chatId)
    if (!location) {
      return null
    }
    const { chat, project } = location
    return chatPullRequests.get(chat.worktree ?? project.path, chat.githubAccount, fresh)
  })

  ipcMain.handle(IpcChannel.UpdatesState, () => updater?.state ?? null)
  ipcMain.on(IpcChannel.UpdatesInstall, () => updater?.installAndRelaunch())
  ipcMain.handle(IpcChannel.UpdatesCurrentVersion, () => app.getVersion())
  ipcMain.handle(IpcChannel.UpdatesCheck, () => updater?.checkNow() ?? 'unsupported')

  ipcMain.handle(IpcChannel.SystemUserProfile, getUserProfile)

  ipcMain.on(IpcChannel.SystemBadgeCount, (_event, count: unknown) => {
    const valid = typeof count === 'number' && Number.isSafeInteger(count) && count > 0
    app.setBadgeCount(valid ? count : 0)
  })

  ipcMain.on(IpcChannel.SystemFocusWindow, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) {
      if (window.isMinimized()) {
        window.restore()
      }
      window.show()
      app.focus({ steal: true })
    }
  })

  ipcMain.handle(IpcChannel.PlanLimitsGet, () => planLimits.get())
  ipcMain.handle(IpcChannel.PlanLimitsRefresh, () => planLimits.refreshAll())
  ipcMain.handle(IpcChannel.TokenSpendGet, () => tokenSpend.summary())

  ipcMain.handle(IpcChannel.AccountsList, () => accounts.list())
  ipcMain.handle(IpcChannel.AccountsRefresh, () => accounts.refresh())
  ipcMain.handle(IpcChannel.AccountsAdd, (_event, agent: unknown) => {
    if (!isAgentId(agent)) {
      throw new Error('Invalid agent')
    }
    return accounts.add(agent)
  })
  ipcMain.handle(IpcChannel.AccountsRename, (_event, accountId: unknown, name: unknown) => {
    if (typeof accountId !== 'string' || typeof name !== 'string') {
      throw new Error('Invalid account')
    }
    accounts.rename(accountId, name)
  })
  ipcMain.handle(IpcChannel.AccountsRemove, async (event, accountId: unknown) => {
    if (typeof accountId !== 'string') {
      throw new Error('Invalid account')
    }
    const account = accounts.list().find(({ id }) => id === accountId)
    if (!account || account.main) {
      return false
    }
    const confirmed = await confirm(BrowserWindow.fromWebContents(event.sender), {
      message: `Remove “${account.name}”?`,
      detail:
        'Atox signs out of this account and deletes its data. Chats that used it keep their ' +
        'history and continue under the main account; running ones are stopped.',
      confirmLabel: 'Remove'
    })
    if (confirmed) {
      await accounts.remove(accountId)
    }
    return confirmed
  })
  ipcMain.handle(IpcChannel.AccountsSignIn, (_event, accountId: unknown) => {
    if (typeof accountId !== 'string') {
      throw new Error('Invalid account')
    }
    return accounts.signIn(accountId)
  })
  ipcMain.handle(IpcChannel.AccountsCancelSignIn, (_event, accountId: unknown) => {
    if (typeof accountId === 'string') {
      accounts.cancelSignIn(accountId)
    }
  })

  ipcMain.on(IpcChannel.SettingsGet, (event) => {
    event.returnValue = settings.get()
  })
  ipcMain.handle(IpcChannel.SettingsUpdate, (_event, patch: Partial<Settings>) =>
    settings.update(patch)
  )
  settings.onChange((next) => broadcast(IpcChannel.SettingsChanged, next))

  ipcMain.handle(IpcChannel.GitHubAccounts, () => githubAccounts.list())
  ipcMain.handle(IpcChannel.GitHubActivate, async (_event, login: unknown) => {
    if (typeof login !== 'string') {
      throw new Error('Invalid GitHub account')
    }
    await githubAccounts.activate(login)
    return githubAccounts.list()
  })

  ipcMain.handle(IpcChannel.BoardGet, () => board.state())
  ipcMain.handle(IpcChannel.BoardRefresh, () => board.refresh())
  ipcMain.handle(IpcChannel.BoardAvailableRepositories, () => board.availableRepositories())
  ipcMain.handle(IpcChannel.BoardSetRepositories, (_event, repositories: unknown) =>
    board.setRepositories(Array.isArray(repositories) ? repositories : [])
  )
  ipcMain.handle(IpcChannel.BoardDefaultProject, (_event, repository: unknown) =>
    typeof repository === 'string' ? board.defaultProjectId(repository) : null
  )
  ipcMain.handle(
    IpcChannel.BoardMove,
    async (event, issueId: unknown, column: unknown, start: unknown) => {
      if (typeof issueId !== 'string' || !isBoardColumn(column)) {
        throw new Error('Invalid board move')
      }
      // Done удаляет чат агента и worktree задачи: случайный перенос не должен стоить работы.
      const confirmed =
        column !== 'done' ||
        !board.chatOf(issueId) ||
        (await confirm(BrowserWindow.fromWebContents(event.sender), {
          message: 'Delete the agent chat and worktree?',
          detail:
            'Moving the task to Done deletes its agent chat and git worktree, including changes that are not committed. The pushed branch and the pull request stay on GitHub.',
          confirmLabel: 'Move to Done'
        }))
      return confirmed ? board.move(issueId, column, parseTaskStart(start)) : board.state()
    }
  )

  ipcMain.handle(IpcChannel.CanvasGet, () => canvas.state())
  ipcMain.handle(IpcChannel.CanvasCreate, (_event, chatId: unknown) =>
    canvas.create(requireId(chatId))
  )
  ipcMain.handle(IpcChannel.CanvasAddPage, (_event, chatId: unknown) =>
    canvas.addPage(requireId(chatId))
  )
  ipcMain.handle(
    IpcChannel.CanvasCreateStandalone,
    (_event, projectId: unknown, name: unknown, look: unknown) =>
      canvas.createStandalone(requireId(projectId), name, look ?? undefined)
  )
  ipcMain.handle(IpcChannel.CanvasAddBlankScreen, (_event, canvasId: unknown, look: unknown) =>
    canvas.addBlankScreen(requireId(canvasId), look)
  )
  ipcMain.handle(IpcChannel.CanvasLinkChat, (_event, canvasId: unknown, chatId: unknown) =>
    canvas.linkChat(requireId(canvasId), requireId(chatId))
  )
  ipcMain.handle(IpcChannel.CanvasReorderPages, (_event, chatId: unknown, pageIds: unknown) => {
    if (!Array.isArray(pageIds) || !pageIds.every((id) => typeof id === 'string')) {
      throw new Error('Invalid page list')
    }
    canvas.reorderPages(requireId(chatId), pageIds)
  })
  ipcMain.handle(IpcChannel.CanvasRename, (_event, canvasId: unknown, name: unknown) =>
    canvas.rename(requireId(canvasId), name)
  )
  ipcMain.handle(
    IpcChannel.CanvasRenameScreen,
    (_event, canvasId: unknown, screenId: unknown, name: unknown) =>
      canvas.renameScreen(requireId(canvasId), requireId(screenId), name)
  )
  ipcMain.handle(
    IpcChannel.CanvasMoveScreen,
    (_event, canvasId: unknown, screenId: unknown, x: unknown, y: unknown) =>
      canvas.moveScreen(requireId(canvasId), requireId(screenId), x, y)
  )
  ipcMain.handle(
    IpcChannel.CanvasRenameGroup,
    (_event, canvasId: unknown, groupId: unknown, name: unknown) =>
      canvas.renameGroup(requireId(canvasId), requireId(groupId), name)
  )
  ipcMain.handle(
    IpcChannel.CanvasMoveGroup,
    (_event, canvasId: unknown, groupId: unknown, dx: unknown, dy: unknown) =>
      canvas.moveGroup(requireId(canvasId), requireId(groupId), dx, dy)
  )
  ipcMain.handle(IpcChannel.CanvasUngroup, (_event, canvasId: unknown, groupId: unknown) =>
    canvas.ungroup(requireId(canvasId), requireId(groupId))
  )
  // Не вышло опубликовать или закрыть ссылку (нет сети, служба отказала) — человек видит причину.
  ipcMain.handle(IpcChannel.CanvasShare, async (event, canvasId: unknown) => {
    try {
      return await canvas.share(requireId(canvasId))
    } catch (error) {
      await inform(BrowserWindow.fromWebContents(event.sender), {
        type: 'error',
        message: 'Could not share the canvas',
        detail: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  })
  // Закрытую ссылку не вернуть: у новой будет другой адрес. Поэтому — только после подтверждения.
  ipcMain.handle(IpcChannel.CanvasStopSharing, async (event, canvasId: unknown) => {
    const id = requireId(canvasId)
    const window = BrowserWindow.fromWebContents(event.sender)
    const confirmed = await confirm(window, {
      message: 'Stop sharing this canvas?',
      detail: 'The link stops working for everyone who has it. Sharing again creates a new link.',
      confirmLabel: 'Stop sharing'
    })
    if (!confirmed) {
      return
    }
    try {
      await canvas.unshare(id)
    } catch (error) {
      await inform(window, {
        type: 'error',
        message: 'Could not stop sharing the canvas',
        detail: error instanceof Error ? error.message : String(error)
      })
    }
  })
  ipcMain.handle(IpcChannel.CanvasSetView, (_event, canvasId: unknown, view: unknown) =>
    canvas.setView(requireId(canvasId), view)
  )
  ipcMain.handle(IpcChannel.CanvasSetGrid, (_event, canvasId: unknown, grid: unknown) =>
    canvas.setGrid(requireId(canvasId), grid)
  )
  ipcMain.handle(IpcChannel.CanvasArchive, (_event, canvasId: unknown, archived: unknown) => {
    if (typeof archived !== 'boolean') {
      throw new Error('Invalid archive flag')
    }
    canvas.archive(requireId(canvasId), archived)
  })
  ipcMain.handle(IpcChannel.CanvasRemove, async (event, canvasId: unknown) => {
    const id = requireId(canvasId)
    const target = canvas.state().canvases.find((other) => other.id === id)
    if (!target) {
      throw new Error('The canvas was not found.')
    }
    const confirmed = await confirm(BrowserWindow.fromWebContents(event.sender), {
      message: `Delete the page “${target.name}”?`,
      detail: 'Screen files stay in the project.',
      confirmLabel: 'Delete'
    })
    if (confirmed) {
      await canvas.remove(id)
    }
  })
  ipcMain.handle(IpcChannel.CanvasRemoveCanvas, async (event, chatId: unknown) => {
    const id = requireId(chatId)
    const pages = canvas.state().canvases.filter((other) => other.chatId === id)
    if (pages.length === 0) {
      throw new Error('The canvas was not found.')
    }
    const confirmed = await confirm(BrowserWindow.fromWebContents(event.sender), {
      message: 'Delete this canvas?',
      detail:
        pages.length === 1
          ? 'Screen files stay in the project.'
          : `All ${pages.length} pages are deleted. Screen files stay in the project.`,
      confirmLabel: 'Delete'
    })
    if (confirmed) {
      await canvas.removeChatCanvas(id)
    }
  })
  ipcMain.handle(
    IpcChannel.CanvasRemoveScreen,
    async (event, canvasId: unknown, screenId: unknown) => {
      const id = requireId(canvasId)
      const screen = requireId(screenId)
      const target = canvas
        .state()
        .canvases.find((other) => other.id === id)
        ?.screens.find((other) => other.id === screen)
      if (!target) {
        throw new Error('The screen was not found.')
      }
      const confirmed = await confirm(BrowserWindow.fromWebContents(event.sender), {
        message: `Remove “${target.name}” from the canvas?`,
        detail: 'The screen file stays in the project.',
        confirmLabel: 'Remove'
      })
      if (confirmed) {
        await canvas.removeScreenById(id, screen)
      }
    }
  )
  ipcMain.handle(IpcChannel.CanvasExport, async (event, canvasId: unknown, format: unknown) => {
    const id = requireId(canvasId)
    if (!isCanvasExportFormat(format)) {
      throw new Error('Invalid export format')
    }
    const target = canvas.state().canvases.find((other) => other.id === id)
    if (!target) {
      throw new Error('The canvas was not found.')
    }
    const window = BrowserWindow.fromWebContents(event.sender)
    const path = await chooseExportTarget(window, target.name, format)
    if (!path) {
      return null
    }
    let result
    try {
      result = await canvas.exportCanvas(id, format, path)
    } catch (error) {
      await inform(window, {
        type: 'error',
        message: 'Could not export the canvas',
        detail: error instanceof Error ? error.message : String(error)
      })
      return null
    }
    shell.showItemInFolder(path)
    if (result.warnings.length > 0) {
      await inform(window, {
        type: 'warning',
        message: 'Exported, but some screens are not up to date',
        detail: result.warnings.join('\n')
      })
    }
    return result
  })
  ipcMain.handle(
    IpcChannel.CanvasRequest,
    (_event, canvasId: unknown, text: unknown, screenId: unknown) =>
      canvas.request(
        requireId(canvasId),
        text,
        screenId === undefined || screenId === null ? undefined : requireId(screenId)
      )
  )
  ipcMain.handle(IpcChannel.CanvasHistory, (_event, canvasId: unknown, screenId: unknown) =>
    canvas.history(requireId(canvasId), requireId(screenId))
  )
  ipcMain.handle(
    IpcChannel.CanvasRestore,
    (_event, canvasId: unknown, screenId: unknown, versionId: unknown) =>
      canvas.restore(requireId(canvasId), requireId(screenId), requireId(versionId))
  )

  ipcMain.on(IpcChannel.ShortcutsRecording, (_event, recording: boolean) =>
    menu.setRecordingShortcut(recording === true)
  )
}

/** Id чата, холста, экрана или версии из окна: непустая строка. */
function requireId(value: unknown): string {
  if (typeof value !== 'string' || !value) {
    throw new Error('Invalid id')
  }
  return value
}

/** Запуск задачи из окна: агент обязателен, сообщение — только непустой текст. */
function parseTaskStart(value: unknown): TaskStart | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }
  const { agent, message, projectId } = value as Record<string, unknown>
  const parsed = parseTaskAgent(agent)
  if (!parsed) {
    return undefined
  }
  return {
    agent: parsed,
    ...(typeof message === 'string' && message.trim() && { message: message.trim() }),
    ...(typeof projectId === 'string' && projectId && { projectId })
  }
}

/** Настройки чата из окна: берутся только известные поля нужных типов. */
function parseConfiguration(value: unknown): ChatConfiguration {
  const source =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  const optionalString = (field: unknown) =>
    field === null ? null : typeof field === 'string' && field ? field : undefined
  const model = optionalString(source['model'])
  const effort = optionalString(source['effort'])
  const serviceTier = optionalString(source['serviceTier'])
  const account = optionalString(source['account'])
  return {
    ...(isAgentId(source['agent']) && { agent: source['agent'] }),
    ...(model !== undefined && { model }),
    ...(effort !== undefined && { effort }),
    ...(serviceTier !== undefined && { serviceTier }),
    ...(account !== undefined && { account })
  }
}

/** Размер терминала из окна: целое число символов, не меньше одного. */
function parseTerminalSize(value: unknown): TerminalSize {
  const source =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  const dimension = (field: unknown) =>
    typeof field === 'number' && Number.isFinite(field) ? Math.max(1, Math.floor(field)) : 1
  return { cols: dimension(source['cols']), rows: dimension(source['rows']) }
}

export function broadcastUpdateState(state: UpdateState): void {
  broadcast(IpcChannel.UpdatesStateChanged, state)
}

export function broadcastProjectsChanged(projects: Project[]): void {
  broadcast(IpcChannel.ProjectsChanged, projects)
}

export function broadcastBoard(state: BoardState): void {
  broadcast(IpcChannel.BoardChanged, state)
}

export function broadcastCanvas(state: CanvasState): void {
  broadcast(IpcChannel.CanvasChanged, state)
}

export function broadcastGitBranches(branches: GitBranches): void {
  broadcast(IpcChannel.GitBranchesChanged, branches)
}

/** Строки из списка, который прислало окно; всё остальное отбрасывается. */
function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
}

/** Ответ окна на запрос агента: всё, кроме явного согласия, — отказ. */
function parseRequestAnswer(answer: unknown): RequestAnswer {
  const record = typeof answer === 'object' && answer !== null ? answer : {}
  if (!('accepted' in record) || record.accepted !== true) {
    return { accepted: false }
  }
  const values = 'values' in record ? record.values : undefined
  if (typeof values !== 'object' || values === null || Array.isArray(values)) {
    return { accepted: true }
  }
  return {
    accepted: true,
    values: Object.fromEntries(Object.entries(values).filter(([, value]) => isInputValue(value)))
  }
}

function isInputValue(value: unknown): value is InputValue {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    (Array.isArray(value) && value.every((item) => typeof item === 'string'))
  )
}

export function broadcastTerminalData(projectId: string, data: string): void {
  broadcast(IpcChannel.TerminalsData, projectId, data)
}

export function broadcastTerminalExit(projectId: string): void {
  broadcast(IpcChannel.TerminalsExit, projectId)
}

export function broadcastAgentListsStale(agent: AgentId): void {
  broadcast(IpcChannel.AgentsListsStale, agent)
}

export function broadcastPlanLimits(state: PlanLimitsState): void {
  broadcast(IpcChannel.PlanLimitsChanged, state)
}

export function broadcastAccounts(accounts: AgentAccount[]): void {
  broadcast(IpcChannel.AccountsChanged, accounts)
}

export function broadcastTokenSpend(summary: TokenSpendSummary): void {
  broadcast(IpcChannel.TokenSpendChanged, summary)
}

export function broadcastConversationEvent(event: ConversationEvent): void {
  broadcast(IpcChannel.ConversationsEvent, event)
}

function broadcast(channel: string, ...payload: unknown[]): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, ...payload)
  }
}
