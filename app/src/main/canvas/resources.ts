import { join } from 'node:path'
import { app } from 'electron'

/** Нативный esbuild в собранном приложении: свой для каждой архитектуры (`extraResources`). */
const PACKAGED_ESBUILD = join('esbuild', process.platform === 'win32' ? 'esbuild.exe' : 'esbuild')

/** Путь к esbuild из ресурсов собранного приложения; при разработке — `undefined`, esbuild находит свой сам. */
export function packagedEsbuildBinary(): string | undefined {
  return app.isPackaged ? join(process.resourcesPath, PACKAGED_ESBUILD) : undefined
}

/**
 * Папка с ресурсами холста: при разработке — `resources/` проекта, в собранном приложении —
 * рядом с ним (`extraResources`). Это настоящие файлы, а не часть asar: из них собираются экраны.
 */
export function canvasResourcePath(directory: string): string {
  return app.isPackaged
    ? join(process.resourcesPath, directory)
    : join(app.getAppPath(), 'resources', directory)
}
