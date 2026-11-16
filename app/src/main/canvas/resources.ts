import { join } from 'node:path'
import { app } from 'electron'

/**
 * Папка с ресурсами холста: при разработке — `resources/` проекта, в собранном приложении —
 * рядом с ним (`extraResources`). Это настоящие файлы, а не часть asar: из них собираются экраны.
 */
export function canvasResourcePath(directory: string): string {
  return app.isPackaged
    ? join(process.resourcesPath, directory)
    : join(app.getAppPath(), 'resources', directory)
}
