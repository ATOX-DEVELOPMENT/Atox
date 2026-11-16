import { watch, type FSWatcher } from 'node:fs'
import { stat } from 'node:fs/promises'
import { dirname } from 'node:path'

/** Редакторы и агенты пишут файл в несколько приёмов: проверяем, когда запись утихнет. */
const CHANGE_DEBOUNCE_MS = 150

/**
 * Как часто файлы проверяются опросом. Опрос — страховка: когда удаляют саму папку файла,
 * слежка за папкой молча перестаёт приходить (так ведёт себя macOS).
 */
const FILE_POLL_MS = 2000

interface FolderWatch {
  watcher: FSWatcher | null
  /** Экраны, у которых в папке есть файлы. */
  keys: Set<string>
}

interface ScreenWatch {
  files: readonly string[]
  /** Каким были файлы при прошлом опросе; `undefined` — ещё не опрашивались. */
  signature?: string
}

/**
 * Следит за файлами экранов: у экрана-HTML это один файл, у экрана-React — файл экрана
 * и всё, что он импортирует. Быстро — через слежку за папкой файлов, а не за самими файлами:
 * при атомарном сохранении (запись во временный файл и переименование) файл заменяется
 * другим, и слежка за прежним прервалась бы. Любое событие в папке — повод проверить её
 * экраны: что именно изменилось, решает проверка содержимого. Медленно — опросом файлов:
 * он замечает, что файл пропал вместе с папкой и вернулся.
 */
export class ScreenFileWatcher {
  private readonly folders = new Map<string, FolderWatch>()
  private readonly screens = new Map<string, ScreenWatch>()
  private readonly pending = new Map<string, NodeJS.Timeout>()
  private poller: NodeJS.Timeout | null = null
  private polling = false

  /** `onChange` получает ключ экрана, файл которого мог измениться. */
  constructor(private readonly onChange: (key: string) => void) {}

  /** Берёт под слежку файлы экрана вместо прежних; тот же набор — ничего не меняет. */
  watch(key: string, files: readonly string[]): void {
    const unique = [...new Set(files)]
    const current = this.screens.get(key)
    if (current && sameFiles(current.files, unique)) {
      return
    }
    this.release(key)
    for (const file of unique) {
      this.joinFolder(key, file)
    }
    this.screens.set(key, { files: unique })
    this.poller ??= setInterval(() => void this.poll(), FILE_POLL_MS)
  }

  unwatch(key: string): void {
    clearTimeout(this.pending.get(key))
    this.pending.delete(key)
    this.release(key)
  }

  dispose(): void {
    for (const key of [...this.screens.keys()]) {
      this.unwatch(key)
    }
  }

  /** Снимает слежку, не отменяя уже назначенную проверку: событие не должно потеряться. */
  private release(key: string): void {
    const watched = this.screens.get(key)
    if (!watched) {
      return
    }
    this.screens.delete(key)
    for (const file of watched.files) {
      const folder = dirname(file)
      const entry = this.folders.get(folder)
      entry?.keys.delete(key)
      if (entry && entry.keys.size === 0) {
        entry.watcher?.close()
        this.folders.delete(folder)
      }
    }
    if (this.screens.size === 0 && this.poller) {
      clearInterval(this.poller)
      this.poller = null
    }
  }

  private joinFolder(key: string, file: string): void {
    const folder = dirname(file)
    let entry = this.folders.get(folder)
    if (!entry) {
      entry = { watcher: null, keys: new Set() }
      this.folders.set(folder, entry)
      this.arm(folder, entry)
    }
    entry.keys.add(key)
  }

  /** Сверяет файлы с прошлым опросом: изменившийся экран проверяется, вернувшийся — под слежкой. */
  private async poll(): Promise<void> {
    if (this.polling) {
      return
    }
    this.polling = true
    try {
      for (const [key, watched] of [...this.screens]) {
        const signature = await filesSignature(watched.files)
        if (this.screens.get(key) !== watched) {
          continue
        }
        const previous = watched.signature
        watched.signature = signature
        // Пропавший файл проверяется на каждом опросе: между опросами он мог появиться
        // и пропасть снова, и только проверка знает, что сейчас показывает холст.
        const missing = signature.includes(MISSING)
        if (previous === undefined || (previous === signature && !missing)) {
          continue
        }
        // Файл вернулся — его папку могли создать заново, и прежняя слежка за ней мертва.
        if (previous.includes(MISSING) || missing) {
          this.rearm(watched.files)
        }
        this.schedule(key)
      }
    } finally {
      this.polling = false
    }
  }

  private rearm(files: readonly string[]): void {
    for (const file of files) {
      const folder = dirname(file)
      const entry = this.folders.get(folder)
      if (entry) {
        entry.watcher?.close()
        this.arm(folder, entry)
      }
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
        if (this.screens.has(key)) {
          this.onChange(key)
        }
      }, CHANGE_DEBOUNCE_MS)
    )
  }
}

/** Признак пропавшего файла в подписи опроса. */
const MISSING = '-'

function sameFiles(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((file, index) => file === right[index])
}

/** Подпись файлов: у каждого время изменения и размер, у пропавшего — `MISSING`. */
async function filesSignature(files: readonly string[]): Promise<string> {
  const parts = await Promise.all(
    files.map((file) =>
      stat(file).then(
        ({ mtimeMs, size }) => `${mtimeMs}:${size}`,
        () => MISSING
      )
    )
  )
  return parts.join('|')
}
