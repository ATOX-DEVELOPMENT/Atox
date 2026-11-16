import { watch, type FSWatcher } from 'node:fs'
import { dirname } from 'node:path'

/** Редакторы и агенты пишут файл в несколько приёмов: проверяем, когда запись утихнет. */
const CHANGE_DEBOUNCE_MS = 150

/** Как часто проверять пропавший файл: его папку могли удалить и создать заново. */
const MISSING_RETRY_MS = 2000

interface FolderWatch {
  watcher: FSWatcher | null
  /** Экраны, файлы которых лежат в папке. */
  keys: Set<string>
}

/**
 * Следит за файлами экранов. Смотрит не на сам файл, а на его папку: при атомарном
 * сохранении (запись во временный файл и переименование) файл заменяется другим, и слежка
 * за прежним прервалась бы. Любое событие в папке — повод проверить её экраны: что именно
 * изменилось, решает проверка содержимого.
 */
export class ScreenFileWatcher {
  private readonly folders = new Map<string, FolderWatch>()
  private readonly files = new Map<string, string>()
  private readonly pending = new Map<string, NodeJS.Timeout>()
  private readonly retries = new Map<string, NodeJS.Timeout>()

  /** `onChange` получает ключ экрана, файл которого мог измениться. */
  constructor(private readonly onChange: (key: string) => void) {}

  watch(key: string, file: string): void {
    if (this.files.get(key) === file) {
      return
    }
    this.unwatch(key)
    this.files.set(key, file)
    const folder = dirname(file)
    let entry = this.folders.get(folder)
    if (!entry) {
      entry = { watcher: null, keys: new Set() }
      this.folders.set(folder, entry)
      this.arm(folder, entry)
    }
    entry.keys.add(key)
  }

  unwatch(key: string): void {
    const file = this.files.get(key)
    clearTimeout(this.pending.get(key))
    clearTimeout(this.retries.get(key))
    this.pending.delete(key)
    this.retries.delete(key)
    this.files.delete(key)
    if (file === undefined) {
      return
    }
    const folder = dirname(file)
    const entry = this.folders.get(folder)
    entry?.keys.delete(key)
    if (entry && entry.keys.size === 0) {
      entry.watcher?.close()
      this.folders.delete(folder)
    }
  }

  /**
   * Файла экрана нет: слежка за папкой могла прерваться вместе с ней. Пока файл не вернётся,
   * папка время от времени заново берётся под слежку, а экран проверяется.
   */
  retryMissing(key: string): void {
    const file = this.files.get(key)
    if (file === undefined || this.retries.has(key)) {
      return
    }
    this.retries.set(
      key,
      setTimeout(() => {
        this.retries.delete(key)
        const folder = dirname(file)
        const entry = this.folders.get(folder)
        if (this.files.get(key) !== file || !entry) {
          return
        }
        entry.watcher?.close()
        this.arm(folder, entry)
        this.schedule(key)
      }, MISSING_RETRY_MS)
    )
  }

  dispose(): void {
    for (const key of [...this.files.keys()]) {
      this.unwatch(key)
    }
  }

  private arm(folder: string, entry: FolderWatch): void {
    try {
      const watcher = watch(folder, { persistent: false }, () => this.folderChanged(entry))
      // Папку удалили или к ней пропал доступ: файлы её экранов теперь не читаются.
      watcher.on('error', () => {
        watcher.close()
        if (entry.watcher === watcher) {
          entry.watcher = null
        }
        this.folderChanged(entry)
      })
      entry.watcher = watcher
    } catch {
      entry.watcher = null
      this.folderChanged(entry)
    }
  }

  private folderChanged(entry: FolderWatch): void {
    for (const key of entry.keys) {
      this.schedule(key)
    }
  }

  private schedule(key: string): void {
    clearTimeout(this.pending.get(key))
    this.pending.set(
      key,
      setTimeout(() => {
        this.pending.delete(key)
        if (this.files.has(key)) {
          this.onChange(key)
        }
      }, CHANGE_DEBOUNCE_MS)
    )
  }
}
