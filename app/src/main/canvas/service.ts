import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, realpath, rename, stat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join } from 'node:path'
import {
  DEFAULT_SCREEN_DEVICE,
  SCREEN_DEVICES,
  SCREEN_HISTORY_LIMIT,
  canvasScreenUrl,
  isScreenDeviceId,
  screenSourceKind,
  type CanvasState,
  type ScreenDevice,
  type ScreenDeviceId,
  type ScreenVersion
} from '../../shared/canvas'
import { CANVAS_KIT_ENTRY } from '../../shared/canvasRuntime'
import type { ConversationManager } from '../conversations/manager'
import { JsonFileWriter, readVersionedJson } from '../jsonFile'
import type { ChatLocation, ProjectStore } from '../store'
import { ScreenBuildError, buildScreen, type ScreenBuild } from './build'
import { captureScreen, inspectScreen, type ScreenRender } from './capture'
import type { ScreenDocument, ScreenDocumentSource } from './protocol'
import {
  CanvasError,
  SCREEN_FILE_MAX_BYTES,
  SCREEN_FILE_MAX_MB,
  appendVersion,
  canvasNameFromTitle,
  describeOverflow,
  findScreenByName,
  formatCanvasMessage,
  formatFixMessage,
  isInsideFolder,
  isScreenFileName,
  parseName,
  parseScreenSize,
  placeNewScreen
} from './rules'
import { renderBuildErrorPage, renderShell } from './shell'
import { ScreenSnapshots, contentHash } from './snapshots'
import {
  CANVAS_FILE_VERSION,
  normalizeCanvases,
  normalizeView,
  publicCanvas,
  type CanvasFile,
  type StoredCanvas,
  type StoredScreen,
  type StoredVersion
} from './store'
import { ScreenFileWatcher } from './watcher'

export interface CanvasServices {
  store: ProjectStore
  conversations: ConversationManager
  /** Папка кита `@atox/ui` и токенов темы: из неё собираются экраны-React. */
  kitDirectory: string
  onChange(state: CanvasState): void
}

/** Экран, который агент ставит на холст командой `atox canvas screen set`. */
export interface AgentScreenRequest {
  name: string
  /** Абсолютный путь к файлу экрана: HTML или React-компонент. */
  file: string
  device?: string
  /** `WxH` — свой размер экрана. */
  size?: string
}

export interface AgentScreenResult {
  canvas: string
  screen: string
  /** Холста у чата не было — его создала эта команда. */
  canvasCreated: boolean
  /** Экрана с таким именем не было — он добавлен. */
  created: boolean
  device: ScreenDevice
  width: number
  height: number
  file: string
  /** Что не так с раскладкой экрана; пусто — всё помещается или измерить не удалось. */
  layout: string[]
  /** Сборка экрана-React не удалась: «файл:строка: что не так»; `null` — собрался. */
  buildError: string | null
  /** Ошибки, которые вывела страница экрана при открытии. */
  runtimeErrors: string[]
}

export interface AgentScreenPreview {
  screen: string
  /** Абсолютный путь к PNG экрана. */
  path: string
  layout: string[]
  buildError: string | null
  runtimeErrors: string[]
}

export interface AgentCanvasView {
  name: string
  screens: {
    name: string
    device: ScreenDevice
    width: number
    height: number
    file: string
    missing: boolean
    buildError: string | null
  }[]
}

interface ScreenLocation {
  canvas: StoredCanvas
  screen: StoredScreen
}

/**
 * Холсты чатов: экраны из файлов проекта (React-компонент или HTML), за которыми приложение
 * следит. У экрана-React следят и за всем, что он импортирует, и пересобирают его.
 * Каждое изменение файла экрана становится версией (снимок хранится в данных приложения),
 * и окно перезагружает экран по новой ревизии. Файлы экранов принадлежат проекту: холст их
 * только читает, а пишет лишь при восстановлении версии по просьбе человека.
 */
export class CanvasService implements ScreenDocumentSource {
  private readonly watcher = new ScreenFileWatcher((key) => void this.queueCheck(key))
  /** Проверки файлов идут по одной на экран: иначе одно изменение стало бы двумя версиями. */
  private readonly checks = new Map<string, Promise<void>>()
  /** Экраны, в файл которых записана версия из истории: следующая версия — восстановление. */
  private readonly restoring = new Set<string>()
  /** Последняя удачная сборка каждого экрана-React: её показывает холст, пока новая не готова. */
  private readonly builds = new Map<string, ScreenBuild>()
  /** Хеш того, что показывает экран сейчас: у HTML — файл, у React — результат сборки. */
  private readonly outputs = new Map<string, string>()

  private constructor(
    private readonly services: CanvasServices,
    private readonly file: JsonFileWriter,
    private readonly snapshots: ScreenSnapshots,
    private canvases: StoredCanvas[]
  ) {}

  static async load(
    services: CanvasServices,
    filePath: string,
    historyDirectory: string
  ): Promise<CanvasService> {
    const data = await readVersionedJson<CanvasFile>(filePath, CANVAS_FILE_VERSION)
    const projectIds = new Set(services.store.list().map(({ id }) => id))
    const service = new CanvasService(
      services,
      new JsonFileWriter(filePath),
      new ScreenSnapshots(historyDirectory),
      normalizeCanvases(data, projectIds, Date.now())
    )
    // Пока приложение было закрыто, файлы могли поменять: проверка заметит это сразу.
    for (const canvas of service.canvases) {
      if (!canvas.archived) {
        service.watchCanvas(canvas)
      }
    }
    return service
  }

  state(): CanvasState {
    return { canvases: this.canvases.map(publicCanvas) }
  }

  /** Холст чата вне архива; нет — создаётся пустой с названием чата. */
  create(chatId: string): string {
    const existing = this.activeCanvasOf(chatId)
    if (existing) {
      return existing.id
    }
    const location = this.services.store.findChat(chatId)
    if (!location) {
      throw new CanvasError('The chat was not found.')
    }
    const canvas = this.addCanvas(location)
    this.changed()
    return canvas.id
  }

  rename(canvasId: string, name: unknown): void {
    const canvas = this.getCanvas(canvasId)
    canvas.name = parseName(name, 'canvas')
    canvas.updatedAt = Date.now()
    this.changed()
  }

  /** Имена экранов на холсте разные: по имени агент находит экран. */
  renameScreen(canvasId: string, screenId: string, name: unknown): void {
    const { canvas, screen } = this.getScreen(canvasId, screenId)
    const screenName = parseName(name, 'screen')
    const namesake = findScreenByName(canvas.screens, screenName)
    if (namesake && namesake !== screen) {
      throw new CanvasError(`Another screen on this canvas is already called “${namesake.name}”.`)
    }
    screen.name = screenName
    this.changed()
  }

  moveScreen(canvasId: string, screenId: string, x: unknown, y: unknown): void {
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
      throw new CanvasError('Invalid screen position.')
    }
    const { screen } = this.getScreen(canvasId, screenId)
    screen.x = x
    screen.y = y
    this.changed()
  }

  setView(canvasId: string, view: unknown): void {
    const canvas = this.getCanvas(canvasId)
    const normalized = normalizeView(view)
    if (!normalized) {
      throw new CanvasError('Invalid canvas view.')
    }
    canvas.view = normalized
    this.changed()
  }

  /** В архиве за файлами холста не следят; вернувшийся холст сразу проверяет их. */
  archive(canvasId: string, archived: boolean): void {
    const canvas = this.getCanvas(canvasId)
    if (canvas.archived === archived) {
      return
    }
    if (!archived) {
      const active = this.activeCanvasOf(canvas.chatId)
      if (active) {
        throw new CanvasError(
          `The chat already has the canvas “${active.name}”. Archive it first.`
        )
      }
    }
    canvas.archived = archived
    if (archived) {
      this.unwatchCanvas(canvas)
    } else {
      this.watchCanvas(canvas)
    }
    this.changed()
  }

  /** Удаляет холст и снимки его версий; HTML-файлы экранов остаются в проекте. */
  async remove(canvasId: string): Promise<void> {
    const canvas = this.getCanvas(canvasId)
    this.unwatchCanvas(canvas)
    this.canvases = this.canvases.filter((other) => other !== canvas)
    this.changed()
    await this.snapshots
      .removeCanvas(canvas.id)
      .catch((error) => console.error('Failed to remove the canvas history', error))
  }

  /** Проект убрали из Atox — его холсты больше негде показать. */
  async removeProject(projectId: string): Promise<void> {
    const canvases = this.canvases.filter((canvas) => canvas.projectId === projectId)
    await Promise.all(canvases.map((canvas) => this.remove(canvas.id)))
  }

  /**
   * Просьба человека в чат холста. С экраном это «Fix»: к тексту добавляются файл экрана
   * и его скриншот, а текст запоминается для следующей версии экрана.
   */
  async request(canvasId: string, text: unknown, screenId?: string): Promise<void> {
    const canvas = this.getCanvas(canvasId)
    const message = typeof text === 'string' ? text.trim() : ''
    if (!message) {
      throw new CanvasError('The message is empty.')
    }
    const chatId = this.chatOf(canvas)
    // Чат назван по просьбе человека, а не по служебному началу сообщения.
    const options = { titleFrom: message }
    if (screenId === undefined) {
      await this.services.conversations.send(chatId, formatCanvasMessage(message), {}, options)
      return
    }
    const { screen } = this.getScreen(canvasId, screenId)
    const screenshot = (await this.render(canvas, screen))?.path ?? null
    const previousFix = screen.pendingFix
    screen.pendingFix = message
    this.persist()
    try {
      await this.services.conversations.send(
        chatId,
        formatFixMessage({
          screenName: screen.name,
          canvasName: canvas.name,
          text: message,
          file: screen.file,
          screenshot,
          buildError: screen.buildError
        }),
        {},
        options
      )
    } catch (error) {
      if (previousFix === undefined) {
        delete screen.pendingFix
      } else {
        screen.pendingFix = previousFix
      }
      this.persist()
      throw error
    }
  }

  /** Версии экрана, от новой к старой. */
  history(canvasId: string, screenId: string): ScreenVersion[] {
    const { screen } = this.getScreen(canvasId, screenId)
    return screen.versions.toReversed().map(({ hash: _hash, ...version }) => version)
  }

  /**
   * Записывает снимок версии в файл экрана. Проверка файла делает из этого новую версию
   * с причиной «restore» — её видят и холст, и агент, который правит файл.
   */
  async restore(canvasId: string, screenId: string, versionId: string): Promise<void> {
    const { canvas, screen } = this.getScreen(canvasId, screenId)
    const version = screen.versions.find(({ id }) => id === versionId)
    if (!version) {
      throw new CanvasError('This version is no longer in the history.')
    }
    if (version === screen.versions.at(-1) && !screen.missing) {
      return
    }
    const content = await this.snapshots.read(canvas.id, screen.id, version.hash).catch(() => {
      throw new CanvasError('The saved copy of this version is missing.')
    })
    const key = screenKey(canvas.id, screen.id)
    this.restoring.add(key)
    try {
      await writeFileAtomically(screen.file, content)
    } catch (error) {
      this.restoring.delete(key)
      console.error('Failed to restore a canvas screen', error)
      throw new CanvasError(`Could not write ${screen.file}.`)
    }
    await this.queueCheck(key)
  }

  async screenDocument(
    canvasId: string,
    screenId: string,
    versionId?: string
  ): Promise<ScreenDocument | null> {
    const location = this.findScreen(canvasId, screenId)
    if (!location) {
      return null
    }
    const { canvas, screen } = location
    const version = versionId
      ? screen.versions.find(({ id }) => id === versionId)
      : screen.versions.at(-1)
    if (versionId && !version) {
      return null
    }
    const source = version
      ? await this.snapshots.read(canvas.id, screen.id, version.hash).catch(() => null)
      : // Версий ещё нет (первая проверка файла не закончилась) — показывается сам файл.
        await readScreenFile(screen.file)
    if (source === null) {
      return null
    }
    if (screenSourceKind(screen.file) !== 'react') {
      return { html: source, modules: false }
    }
    return this.reactDocument(canvas, screen, versionId ? source : undefined)
  }

  /**
   * Страница экрана-React. Текущий экран — последняя удачная сборка (идущую сборку
   * дожидаемся); версия из истории собирается из своего снимка с нынешними импортами.
   */
  private async reactDocument(
    canvas: StoredCanvas,
    screen: StoredScreen,
    versionSource?: string
  ): Promise<ScreenDocument> {
    const key = screenKey(canvas.id, screen.id)
    try {
      await this.checks.get(key)
      const build = versionSource
        ? await buildScreen(this.buildRequest(canvas, screen, versionSource))
        : this.builds.get(key)
      if (!build) {
        throw new ScreenBuildError(screen.buildError ?? 'The screen has not been built yet.', [])
      }
      return { html: await renderShell(build, this.services.kitDirectory), modules: true }
    } catch (error) {
      if (!(error instanceof ScreenBuildError)) {
        console.error('Failed to render a React canvas screen', error)
      }
      const message = error instanceof ScreenBuildError ? error.message : 'The screen could not be built.'
      return { html: renderBuildErrorPage(message), modules: false }
    }
  }

  private buildRequest(canvas: StoredCanvas, screen: StoredScreen, source: string) {
    const { store, kitDirectory } = this.services
    const roots = [
      store.findProject(canvas.projectId)?.path,
      store.findChat(canvas.chatId)?.chat.worktree
    ].filter((root) => root !== undefined)
    return { source, file: screen.file, roots, kit: join(kitDirectory, CANVAS_KIT_ENTRY) }
  }

  /** Холст чата для `atox canvas`; `null` — холста нет. */
  describe(chatId: string): AgentCanvasView | null {
    const canvas = this.activeCanvasOf(chatId)
    return canvas
      ? {
          name: canvas.name,
          screens: canvas.screens.map(
            ({ name, device, width, height, file, missing, buildError }) => ({
              name,
              device,
              width,
              height,
              file,
              missing,
              buildError
            })
          )
        }
      : null
  }

  /**
   * Ставит экран на холст чата по просьбе агента: новый — с именем и местом по раскладке,
   * существующий (по имени) — меняет его файл и устройство, но не имя и не место: их
   * выбирает человек.
   */
  async setScreen(caller: ChatLocation, request: AgentScreenRequest): Promise<AgentScreenResult> {
    const name = parseName(request.name, 'screen')
    if (request.device !== undefined && request.size !== undefined) {
      throw new CanvasError('Use either --device or --size, not both.')
    }
    const device = request.device !== undefined ? parseDevice(request.device) : undefined
    const size = request.size !== undefined ? parseScreenSize(request.size) : undefined
    // Агент задачи с доски работает в worktree: его экраны лежат там.
    const folders = [caller.project.path, caller.chat.worktree].filter(
      (folder) => folder !== undefined
    )
    const file = await verifyScreenFile(request.file, folders)
    // Пока проверяли файл, чат могли удалить.
    const location = this.services.store.findChat(caller.chat.id)
    if (!location) {
      throw new CanvasError('This chat no longer exists.')
    }
    const existing = this.activeCanvasOf(location.chat.id)
    const canvas = existing ?? this.addCanvas(location)
    let screen = findScreenByName(canvas.screens, name)
    const created = screen === undefined
    // Без --device и --size существующий экран остаётся на своём устройстве.
    const look = size ? { device: 'custom' as const, ...size } : device && deviceLook(device)
    if (screen) {
      if (screen.file !== file) {
        this.forgetOutput(screenKey(canvas.id, screen.id))
      }
      Object.assign(screen, look, { file })
    } else {
      const newLook = look ?? deviceLook(DEFAULT_SCREEN_DEVICE)
      screen = {
        id: randomUUID(),
        name,
        ...newLook,
        file,
        ...placeNewScreen(canvas.screens, newLook.width),
        revision: 0,
        missing: false,
        buildError: null,
        updatedAt: Date.now(),
        versions: []
      }
      canvas.screens.push(screen)
    }
    canvas.updatedAt = Date.now()
    this.changed()
    const key = screenKey(canvas.id, screen.id)
    this.watcher.watch(key, [file])
    await this.queueCheck(key)
    const inspection = await this.inspect(canvas, screen)
    return {
      canvas: canvas.name,
      screen: screen.name,
      canvasCreated: existing === undefined,
      created,
      device: screen.device,
      width: screen.width,
      height: screen.height,
      file: screen.file,
      layout: describeOverflow(screen, inspection?.size ?? null),
      buildError: screen.buildError,
      runtimeErrors: inspection?.errors ?? []
    }
  }

  /**
   * Снимает экран так, как он выглядит на холсте, чтобы агент проверил свою работу, и
   * измеряет раскладку.
   */
  async previewScreen(chatId: string, name: string): Promise<AgentScreenPreview> {
    const canvas = this.activeCanvasOf(chatId)
    if (!canvas) {
      throw new CanvasError('This chat has no canvas.')
    }
    const screen = findScreenByName(canvas.screens, name)
    if (!screen) {
      const names = canvas.screens.map((other) => `"${other.name}"`).join(', ') || 'none'
      throw new CanvasError(`There is no screen "${name.trim()}" on the canvas. Screens: ${names}.`)
    }
    // Сначала дописывается идущая проверка: снимок должен показать то, что агент только что записал.
    await this.checks.get(screenKey(canvas.id, screen.id))
    const rendered = await this.render(canvas, screen)
    if (!rendered) {
      throw new CanvasError(
        `Could not render the screen "${screen.name}". Check that ${screen.file} exists and opens without errors.`
      )
    }
    return {
      screen: screen.name,
      path: rendered.path,
      layout: describeOverflow(screen, rendered.size),
      buildError: screen.buildError,
      runtimeErrors: rendered.errors
    }
  }

  /** Убирает экран с холста чата по имени; файл экрана остаётся в проекте. */
  async removeScreen(chatId: string, name: string): Promise<string> {
    const canvas = this.activeCanvasOf(chatId)
    if (!canvas) {
      throw new CanvasError('This chat has no canvas.')
    }
    const screen = findScreenByName(canvas.screens, name)
    if (!screen) {
      const names = canvas.screens.map((other) => `"${other.name}"`).join(', ') || 'none'
      throw new CanvasError(`There is no screen "${name.trim()}" on the canvas. Screens: ${names}.`)
    }
    this.watcher.unwatch(screenKey(canvas.id, screen.id))
    this.forgetOutput(screenKey(canvas.id, screen.id))
    canvas.screens = canvas.screens.filter((other) => other !== screen)
    canvas.updatedAt = Date.now()
    this.changed()
    await this.snapshots
      .removeScreen(canvas.id, screen.id)
      .catch((error) => console.error('Failed to remove the screen history', error))
    return screen.name
  }

  flush(): Promise<void> {
    return this.file.flush()
  }

  dispose(): void {
    this.watcher.dispose()
  }

  /** Открывает экран в скрытом окне; экран, который не собрался ни разу, не открывается. */
  private async inspect(canvas: StoredCanvas, screen: StoredScreen) {
    const built = screenSourceKind(screen.file) !== 'react' || this.builds.has(screenKey(canvas.id, screen.id))
    return built
      ? inspectScreen(
          canvasScreenUrl(canvas.id, screen.id, screen.revision),
          screen.width,
          screen.height
        )
      : null
  }

  private forgetOutput(key: string): void {
    this.builds.delete(key)
    this.outputs.delete(key)
  }

  private render(canvas: StoredCanvas, screen: StoredScreen): Promise<ScreenRender | null> {
    return captureScreen(
      canvasScreenUrl(canvas.id, screen.id, screen.revision),
      screen.width,
      screen.height
    )
  }

  private addCanvas({ project, chat }: ChatLocation): StoredCanvas {
    const now = Date.now()
    const canvas: StoredCanvas = {
      id: randomUUID(),
      name: canvasNameFromTitle(chat.title),
      chatId: chat.id,
      projectId: project.id,
      screens: [],
      archived: false,
      view: null,
      createdAt: now,
      updatedAt: now
    }
    this.canvases.push(canvas)
    return canvas
  }

  /** Чат, которому уходят просьбы холста; удалённый или архивный — ошибка, понятная человеку. */
  private chatOf(canvas: StoredCanvas): string {
    if (this.services.store.findChat(canvas.chatId)) {
      return canvas.chatId
    }
    throw new CanvasError(
      this.services.store.findArchivedChat(canvas.chatId)
        ? 'The chat of this canvas is archived. Restore the chat to send requests.'
        : 'The chat of this canvas was deleted, so there is no agent to send this to.'
    )
  }

  private activeCanvasOf(chatId: string): StoredCanvas | undefined {
    return this.canvases.find((canvas) => canvas.chatId === chatId && !canvas.archived)
  }

  private getCanvas(canvasId: string): StoredCanvas {
    const canvas = this.canvases.find(({ id }) => id === canvasId)
    if (!canvas) {
      throw new CanvasError('The canvas was not found.')
    }
    return canvas
  }

  private findScreen(canvasId: string, screenId: string): ScreenLocation | undefined {
    const canvas = this.canvases.find(({ id }) => id === canvasId)
    const screen = canvas?.screens.find(({ id }) => id === screenId)
    return canvas && screen ? { canvas, screen } : undefined
  }

  private getScreen(canvasId: string, screenId: string): ScreenLocation {
    this.getCanvas(canvasId)
    const location = this.findScreen(canvasId, screenId)
    if (!location) {
      throw new CanvasError('The screen was not found.')
    }
    return location
  }

  private watchCanvas(canvas: StoredCanvas): void {
    for (const screen of canvas.screens) {
      const key = screenKey(canvas.id, screen.id)
      this.watcher.watch(key, [screen.file])
      void this.queueCheck(key)
    }
  }

  private unwatchCanvas(canvas: StoredCanvas): void {
    for (const screen of canvas.screens) {
      const key = screenKey(canvas.id, screen.id)
      this.watcher.unwatch(key)
      this.forgetOutput(key)
    }
  }

  private queueCheck(key: string): Promise<void> {
    const next = (this.checks.get(key) ?? Promise.resolve())
      .then(() => this.check(key))
      .catch((error) => console.error('Failed to check a canvas screen', error))
    this.checks.set(key, next)
    void next.finally(() => {
      if (this.checks.get(key) === next) {
        this.checks.delete(key)
      }
    })
    return next
  }

  /**
   * Сверяет файл экрана с тем, что показывает холст. У экрана-React сначала собирается
   * файл вместе с импортами: пока сборка не удалась, холст остаётся на прежней сборке,
   * а ошибка попадает в `buildError`. Изменился файл экрана — появляется версия; изменился
   * только импорт — меняется ревизия (экран перезагружается), версия не нужна.
   */
  private async check(key: string): Promise<void> {
    const location = this.findScreenByKey(key)
    if (!location) {
      return
    }
    const { canvas, screen } = location
    const content = await readScreenFile(screen.file)
    if (this.findScreenByKey(key)?.screen !== screen) {
      return
    }
    if (content === null) {
      this.restoring.delete(key)
      if (!screen.missing) {
        screen.missing = true
        this.changed()
      }
      return
    }
    const hash = contentHash(content)
    const output = await this.compile(key, canvas, screen, content)
    if (this.findScreenByKey(key)?.screen !== screen) {
      return
    }
    if (output === null) {
      this.restoring.delete(key)
      return
    }
    const latest = screen.versions.at(-1)
    const previous = this.outputs.get(key)
    this.outputs.set(key, output)
    const fileChanged = latest?.hash !== hash
    const outputChanged = previous !== undefined && previous !== output
    if (!fileChanged && !outputChanged) {
      this.restoring.delete(key)
      if (screen.missing) {
        screen.missing = false
        this.changed()
      }
      return
    }
    // Версия пишется, когда изменился файл экрана или за ним стоит просьба «Fix»: так просьба
    // остаётся в истории, даже если агент правил только импортированный компонент.
    const record = fileChanged || screen.pendingFix !== undefined
    if (record) {
      await this.snapshots.save(canvas.id, screen.id, hash, content)
      if (this.findScreenByKey(key)?.screen !== screen) {
        // Экран удалили, пока писался снимок: его история не должна остаться на диске.
        await (this.canvases.includes(canvas)
          ? this.snapshots.removeScreen(canvas.id, screen.id)
          : this.snapshots.removeCanvas(canvas.id))
        return
      }
    }
    const cause = this.restoring.delete(key) ? 'restore' : latest ? 'edit' : 'created'
    this.addVersion(canvas, screen, record ? { hash, cause } : null)
  }

  /**
   * Собирает экран-React и берёт под слежку всё, что он импортирует. Возвращает хеш того,
   * что экран показывает; `null` — сборка не удалась (ошибка записана в экран).
   */
  private async compile(
    key: string,
    canvas: StoredCanvas,
    screen: StoredScreen,
    content: string
  ): Promise<string | null> {
    if (screenSourceKind(screen.file) !== 'react') {
      this.setBuildError(screen, null)
      return contentHash(content)
    }
    try {
      const build = await buildScreen(this.buildRequest(canvas, screen, content))
      this.builds.set(key, build)
      this.watcher.watch(key, build.inputs)
      this.setBuildError(screen, null)
      return contentHash(`${build.js}\n${build.css}`)
    } catch (error) {
      if (error instanceof ScreenBuildError) {
        this.watcher.watch(key, [screen.file, ...error.inputs])
      } else {
        console.error('Failed to build a canvas screen', error)
      }
      this.setBuildError(
        screen,
        error instanceof ScreenBuildError ? error.message : 'The screen could not be built.'
      )
      return null
    }
  }

  private setBuildError(screen: StoredScreen, buildError: string | null): void {
    if (screen.buildError !== buildError) {
      screen.buildError = buildError
      this.changed()
    }
  }

  /** Новый вид экрана: ревизия растёт, версия — по `version`; `null` — версию не писать. */
  private addVersion(
    canvas: StoredCanvas,
    screen: StoredScreen,
    version: { hash: string; cause: ScreenVersion['cause'] } | null
  ): void {
    const now = Date.now()
    let dropped: StoredVersion[] = []
    if (version) {
      const fix = version.cause === 'edit' ? screen.pendingFix : undefined
      if (fix !== undefined) {
        delete screen.pendingFix
      }
      const entry: StoredVersion = {
        id: randomUUID(),
        savedAt: now,
        cause: version.cause,
        hash: version.hash,
        ...(fix && { fix })
      }
      const appended = appendVersion(screen.versions, entry, SCREEN_HISTORY_LIMIT)
      screen.versions = appended.versions
      dropped = appended.dropped
    }
    screen.missing = false
    screen.revision += 1
    screen.updatedAt = now
    canvas.updatedAt = now
    this.changed()
    const kept = new Set(screen.versions.map(({ hash }) => hash))
    const unused = new Set(dropped.map(({ hash }) => hash).filter((hash) => !kept.has(hash)))
    if (unused.size > 0) {
      void this.snapshots
        .remove(canvas.id, screen.id, unused)
        .catch((error) => console.error('Failed to remove old screen versions', error))
    }
  }

  private findScreenByKey(key: string): ScreenLocation | undefined {
    const [canvasId = '', screenId = ''] = key.split('/')
    return this.findScreen(canvasId, screenId)
  }

  private persist(): void {
    const data: CanvasFile = { version: CANVAS_FILE_VERSION, canvases: this.canvases }
    this.file.write(data)
  }

  /** Сохраняет холсты и сообщает окну новое состояние. */
  private changed(): void {
    this.persist()
    this.services.onChange(this.state())
  }
}

function screenKey(canvasId: string, screenId: string): string {
  return `${canvasId}/${screenId}`
}

function deviceLook(device: ScreenDeviceId): {
  device: ScreenDevice
  width: number
  height: number
} {
  const { width, height } = SCREEN_DEVICES[device]
  return { device, width, height }
}

function parseDevice(value: string): ScreenDeviceId {
  if (!isScreenDeviceId(value)) {
    throw new CanvasError(
      `Unknown device "${value}". Use one of: ${Object.keys(SCREEN_DEVICES).join(', ')}.`
    )
  }
  return value
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Содержимое файла экрана; `null` — файла нет, он не читается или слишком велик. */
async function readScreenFile(file: string): Promise<string | null> {
  try {
    const info = await stat(file)
    if (!info.isFile() || info.size > SCREEN_FILE_MAX_BYTES) {
      return null
    }
    return await readFile(file, 'utf-8')
  } catch {
    return null
  }
}

/** Что агент слышит, если файл не годится в экран. */
function notAScreenFile(file: string): CanvasError {
  return new CanvasError(
    `${file} is not a screen file. A screen is a .tsx or .jsx file with a default-exported React component, or one self-contained .html file.`
  )
}

/**
 * Проверяет файл, который агент ставит на холст, и возвращает его настоящий путь (без
 * символических ссылок). Файл должен быть экраном (React или HTML) разумного размера внутри
 * папки чата: холст не показывает файлы вне проекта.
 */
async function verifyScreenFile(file: string, folders: readonly string[]): Promise<string> {
  if (!isAbsolute(file) || !isScreenFileName(file)) {
    throw notAScreenFile(file)
  }
  const real = await realpath(file).catch(() => {
    throw new CanvasError(
      `File not found: ${file}. Write the screen file first, then run this command.`
    )
  })
  const info = await stat(real)
  if (!info.isFile() || !isScreenFileName(real)) {
    throw notAScreenFile(file)
  }
  if (info.size > SCREEN_FILE_MAX_BYTES) {
    throw new CanvasError(
      `${file} is larger than ${SCREEN_FILE_MAX_MB} MB. Keep the file light: inline SVG instead of embedded photos, split code into imported files.`
    )
  }
  const roots = await Promise.all(folders.map((folder) => realpath(folder).catch(() => null)))
  if (!roots.some((root) => root !== null && isInsideFolder(real, root))) {
    throw new CanvasError(
      `${file} is outside this chat's project folder (${folders[0]}). Put screen files inside the project, for example .atox/canvas/${basename(file)}.`
    )
  }
  return real
}

/**
 * Записывает файл через временный рядом с ним: агент или редактор не прочитают его
 * наполовину записанным. Папку файла создаёт, если её удалили.
 */
async function writeFileAtomically(file: string, content: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  const temporary = join(dirname(file), `.${basename(file)}.${process.pid}.tmp`)
  const handle = await open(temporary, 'w')
  try {
    await handle.writeFile(content, 'utf-8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  await rename(temporary, file)
}
