import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Хеш содержимого экрана: по нему снимки не повторяются и называются файлы истории. */
export function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Снимки HTML версий экранов в данных приложения: `<холст>/<экран>/<хеш>.html`. Одинаковое
 * содержимое хранится одним файлом, сколько бы версий на него ни ссылалось. Id и хеши
 * проверены заранее, поэтому путь не выходит за папку истории.
 */
export class ScreenSnapshots {
  constructor(private readonly root: string) {}

  async save(canvasId: string, screenId: string, hash: string, content: string): Promise<void> {
    const directory = join(this.root, canvasId, screenId)
    await mkdir(directory, { recursive: true })
    const path = join(directory, `${hash}.html`)
    // Через временный файл: прерванная запись не оставит снимок, который не совпадает с хешем.
    const temporary = `${path}.${process.pid}.tmp`
    await writeFile(temporary, content, 'utf-8')
    await rename(temporary, path)
  }

  read(canvasId: string, screenId: string, hash: string): Promise<string> {
    return readFile(join(this.root, canvasId, screenId, `${hash}.html`), 'utf-8')
  }

  async remove(canvasId: string, screenId: string, hashes: Iterable<string>): Promise<void> {
    await Promise.all(
      [...hashes].map((hash) =>
        rm(join(this.root, canvasId, screenId, `${hash}.html`), { force: true })
      )
    )
  }

  removeScreen(canvasId: string, screenId: string): Promise<void> {
    return rm(join(this.root, canvasId, screenId), { recursive: true, force: true })
  }

  removeCanvas(canvasId: string): Promise<void> {
    return rm(join(this.root, canvasId), { recursive: true, force: true })
  }
}
