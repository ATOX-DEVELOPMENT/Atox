/** Файлы папки проекта для просмотра кода. */
export interface ProjectFileList {
  /** Пути файлов относительно папки проекта, через «/». */
  files: string[]
  /**
   * Папка проекта относительно корня git-репозитория, с «/» на конце; пусто — проект и есть
   * корень или это не репозиторий. Пути изменений git считает от корня — по нему их сверяют.
   */
  repositoryPrefix: string
  /** Файлов больше, чем показывается: список обрезан. */
  truncated: boolean
}

export type ProjectFileContent =
  | { kind: 'text'; content: string }
  | { kind: 'binary' }
  | { kind: 'too-large'; size: number }
  | { kind: 'missing' }

/** Больше стольких файлов в дереве не показывается: дальше это уже не исходники. */
export const PROJECT_FILES_LIMIT = 50_000

/** Файл крупнее не открывается в просмотре: это сборка или данные, а не код. */
export const PROJECT_FILE_VIEW_LIMIT_BYTES = 2 * 1024 * 1024
