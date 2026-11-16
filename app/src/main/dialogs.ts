import { app, dialog, type BrowserWindow } from 'electron'
import {
  CANVAS_EXPORT_EXTENSIONS,
  type CanvasExportFormat
} from '../shared/canvas'
import { freeExportPath } from './canvas/export'

interface ConfirmationOptions {
  message: string
  detail: string
  confirmLabel: string
}

/** Системный диалог подтверждения; на окне показывается как sheet. `true` — пользователь подтвердил. */
export async function confirm(
  window: BrowserWindow | null,
  { message, detail, confirmLabel }: ConfirmationOptions
): Promise<boolean> {
  const options: Electron.MessageBoxOptions = {
    type: 'warning',
    message,
    detail,
    buttons: [confirmLabel, 'Cancel'],
    defaultId: 0,
    cancelId: 1
  }
  const { response } = window
    ? await dialog.showMessageBox(window, options)
    : await dialog.showMessageBox(options)
  return response === 0
}

/** Системное сообщение с одной кнопкой «OK»; на окне показывается как sheet. */
export async function inform(
  window: BrowserWindow | null,
  { type, message, detail }: Pick<Electron.MessageBoxOptions, 'type' | 'message' | 'detail'>
): Promise<void> {
  const options: Electron.MessageBoxOptions = { type, message, detail, buttons: ['OK'] }
  await (window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options))
}

/**
 * Предупреждение о работающих агентах, например:
 * «Claude is still working in this chat. Deleting the chat will stop it.»
 */
export function describeWorkingAgents(
  count: number,
  location: string,
  consequence: string,
  agentName?: string
): string {
  const subject =
    count === 1 ? `${agentName ?? 'An agent'} is` : `${count} agents are`
  const pronoun = count === 1 ? 'it' : 'them'
  return `${subject} still working ${location}. ${consequence} will stop ${pronoun}.`
}

const EXPORT_FORMAT_NAMES: Record<CanvasExportFormat, string> = {
  pdf: 'PDF document',
  png: 'PNG images',
  pptx: 'PowerPoint presentation'
}

/**
 * Куда выгрузить холст: PDF и PowerPoint — файл по выбору пользователя, PNG — папка, которую
 * создаётся внутри выбранной. `null` — пользователь передумал.
 */
export async function chooseExportTarget(
  window: BrowserWindow | null,
  name: string,
  format: CanvasExportFormat
): Promise<string | null> {
  const downloads = app.getPath('downloads')
  if (format === 'png') {
    const options: Electron.OpenDialogOptions = {
      title: 'Export screens as PNG',
      buttonLabel: 'Export',
      defaultPath: downloads,
      properties: ['openDirectory', 'createDirectory']
    }
    const { canceled, filePaths } = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    const [folder] = filePaths
    // Картинки кладутся в свою папку, чтобы не смешаться с файлами выбранной.
    return canceled || !folder ? null : freeExportPath(folder, name, format)
  }
  const options: Electron.SaveDialogOptions = {
    title: `Export as ${EXPORT_FORMAT_NAMES[format]}`,
    defaultPath: await freeExportPath(downloads, name, format),
    filters: [
      {
        name: EXPORT_FORMAT_NAMES[format],
        extensions: [CANVAS_EXPORT_EXTENSIONS[format].slice(1)]
      }
    ]
  }
  const { canceled, filePath } = window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options)
  return canceled || !filePath ? null : filePath
}
