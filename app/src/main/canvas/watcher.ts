import { watch, type FSWatcher } from 'node:fs'
import { stat } from 'node:fs/promises'
import { dirname } from 'node:path'

/** Редакторы и агенты пишут файл в несколько приёмов: проверяем, когда запись утихнет. */
const CHANGE_DEBOUNCE_MS = 150

/**
 * Как часто файл проверяется опросом. Опрос — страховка: когда удаляют саму папку файла,
 * слежка за папкой молча перестаёт приходить (так ведёт себя macOS).
 */
const FILE_POLL_MS = 2000

interface FolderWatch {
  watcher: FSWatcher | null
  /** Экраны, файлы которых лежат в папке. */
  keys: Set<string>
}

/** Признак файла при опросе: время изменения и размер, `null` — файла нет. */
type FileSignature = string | null

interface FileWatch {
  file: string
  /** Каким файл был при прошлом опросе; `undefined` — ещё не опрашивался. */
  signature?: FileSignature
}

/**
 * Следит за файлами экранов. Быстро — через слежку за папкой файла, а не за самим файлом:
 * при атомарном сохранении (запись во временный файл и переименование) файл заменяется
 * другим, и слежка за прежним прервалась бы. Любое событие в папке — повод проверить её
 * экраны: что именно изменилось, решает проверка содержимого. Медленно — опросом файла:
 * он замечает, что файл пропал вместе с папкой и вернулся.
 */
export class ScreenFileWatcher {
  private readonly folders = new Map<string, FolderWatch>()
  private readonly files = new Map<string, FileWatch>()
  private readonly pending = new Map<string, NodeJS.Timeout>()
  private poller: NodeJS.Timeout | null = null
  private polling = false

  /** `onChange` получает ключ экрана, файл которого мог измениться. */
  constructor(private readonly onChange: (key: string) => void) {}

  watch(key: string, file: string): void {
    if (this.files.get(key)?.file === file) {
      return
    }
    this.unwatch(key)
    const folder = dirname(file)
    let entry = this.folders.get(folder)
    if (!entry) {
      entry = { watcher: null, keys: new Set() }
      this.folders.set(folder, entry)
      this.arm(folder, entry)
    }
    entry.keys.add(key)
    this.files.set(key, { file })
    this.poller ??= setInterval(() => void this.poll(), FILE_POLL_MS)
  }

  unwatch(key: string): void {
    const watched = this.files.get(key)
    clearTimeout(this.pending.get(key))
    this.pending.delete(key)
    if (!watched) {
      return
    }
    this.files.delete(key)
    if (this.files.size === 0 && this.poller) {
      clearInterval(this.poller)
      this.poller = null
    }
    const folder = dirname(watched.file)
    const entry = this.folders.get(folder)
    entry?.keys.delete(key)
    if (entry && entry.keys.size === 0) {
      entry.watcher?.close()
      this.folders.delete(folder)
    }
  }

  dispose(): void {
    for (const key of [...this.files.keys()]) {
      this.unwatch(key)
    }
  }

  /** Сверяет файлы с прошлым опросом: изменившийся проверяется, вернувшийся — снова под слежкой. */
  private async poll(): Promise<void> {
    if (this.polling) {
      return
    }
    this.polling = true
    try {
      for (const [key, watched] of [...this.files]) {
        const signature = await fileSignature(watched.file)
        if (this.files.get(key) !== watched) {
          continue
        }
        const previous = watched.signature
        watched.signature = signature
        // Пропавший файл проверяется на каждом опросе: между опросами он мог появиться
        // и пропасть снова, и только проверка знает, что сейчас показывает холст.
        if (previous === undefined || (previous === signature && signature !== null)) {
          continue
        }
        // Файл появился снова — его папку могли создать заново, и прежняя слежка за ней мертва.
        const entry = this.folders.get(dirname(watched.file))
        if (previous === null && entry) {
          entry.watcher?.close()
          this.arm(dirname(watched.file), entry)
        }
        this.schedule(key)
      }
    } finally {
      this.polling = false
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
      // Папки нет: файл заметит опрос, когда она появится.
      entry.watcher = null
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

async function fileSignature(file: string): Promise<FileSignature> {
  try {
    const { mtimeMs, size } = await stat(file)
    return `${mtimeMs}:${size}`
  } catch {
    return null
  }
}
