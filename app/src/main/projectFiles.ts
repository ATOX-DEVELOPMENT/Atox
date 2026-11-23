import { open, readdir, realpath, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import {
  PROJECT_FILES_LIMIT,
  PROJECT_FILE_VIEW_LIMIT_BYTES,
  type ProjectFileContent,
  type ProjectFileList
} from '../shared/projectFiles'
import { isNotRepositoryError, runGit } from './processes'
import type { ShellEnvironment } from './shellEnvironment'

/** Сколько первых байт смотреть, чтобы отличить текст от двоичного файла. */
const BINARY_SNIFF_BYTES = 8000

/**
 * Папки, которые без git не обходятся: зависимости, сборки и служебные данные. В репозитории
 * то же самое решает `.gitignore`.
 */
const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  '.venv',
  'venv',
  '__pycache__',
  'target',
  '.cache'
])

/** Файлы папки проекта для просмотра кода — только чтение. */
export class ProjectFiles {
  constructor(private readonly shellEnvironment: ShellEnvironment) {}

  /**
   * Все файлы проекта: в репозитории — то, что git знает или увидел бы, без игнорируемого;
   * иначе — обход папки без зависимостей и сборок.
   */
  async list(projectPath: string): Promise<ProjectFileList> {
    const env = await this.shellEnvironment.get()
    try {
      const [listing, prefix] = await Promise.all([
        runGit(['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--deduplicate'], {
          cwd: projectPath,
          env
        }),
        runGit(['rev-parse', '--show-prefix'], { cwd: projectPath, env })
      ])
      const files = [...new Set(listing.split('\0').filter(Boolean))].sort()
      return {
        files: files.slice(0, PROJECT_FILES_LIMIT),
        repositoryPrefix: prefix.trim(),
        truncated: files.length > PROJECT_FILES_LIMIT
      }
    } catch (error) {
      if (!isNotRepositoryError(error)) {
        throw error
      }
    }
    const files: string[] = []
    const truncated = await walk(projectPath, '', files)
    return { files: files.sort(), repositoryPrefix: '', truncated }
  }

  /** Текст файла; путь не может выйти за папку проекта — ни через «..», ни через ссылку. */
  async read(projectPath: string, path: string): Promise<ProjectFileContent> {
    const root = await realpath(projectPath)
    let fullPath: string
    try {
      fullPath = await realpath(join(root, path))
    } catch {
      return { kind: 'missing' }
    }
    const inside = relative(root, fullPath)
    if (!inside || inside.startsWith(`..${sep}`) || inside === '..') {
      throw new Error('The file is outside the project folder.')
    }
    const info = await stat(fullPath)
    if (!info.isFile()) {
      return { kind: 'missing' }
    }
    if (info.size > PROJECT_FILE_VIEW_LIMIT_BYTES) {
      return { kind: 'too-large', size: info.size }
    }
    const file = await open(fullPath, 'r')
    try {
      const content = await file.readFile()
      if (content.subarray(0, BINARY_SNIFF_BYTES).includes(0)) {
        return { kind: 'binary' }
      }
      return { kind: 'text', content: content.toString('utf8') }
    } finally {
      await file.close()
    }
  }
}

/** Обходит папку, складывая пути файлов; `true` — упёрлись в предел и список обрезан. */
async function walk(root: string, directory: string, files: string[]): Promise<boolean> {
  const entries = await readdir(join(root, directory), { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    const path = directory ? `${directory}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name) && (await walk(root, path, files))) {
        return true
      }
    } else if (entry.isFile()) {
      if (files.length >= PROJECT_FILES_LIMIT) {
        return true
      }
      files.push(path)
    }
  }
  return false
}
