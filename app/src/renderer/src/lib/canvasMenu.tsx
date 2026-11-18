import {
  Archive,
  ArchiveRestore,
  ArrowUpRight,
  Copy,
  FileImage,
  FileText,
  MessageCircle,
  Pencil,
  Presentation,
  RefreshCw,
  Trash2,
  Unlink
} from 'lucide-react'
import type { Canvas, CanvasExportFormat } from '../../../shared/canvas'
import type { CanvasNavigation } from '../hooks/CanvasesContext'
import { showMenu, type MenuAnchor, type MenuItem } from './menu'

type CanvasAction = 'open' | 'chat' | 'rename' | 'archive' | 'remove'

interface CanvasMenuOptions {
  /** Пункт «Open»: в списке холстов и в сайдбаре; на странице самого холста его нет. */
  withOpen: boolean
  /** Чат холста ещё есть — к нему можно перейти. */
  chatAvailable: boolean
  navigation: CanvasNavigation
  /** Переименование страницы там, где открыто меню; нет — пункта в меню нет. */
  onRename?(): void
}

/** Меню выгрузки: во что превратить экраны холста. `null` — меню закрыли ничего не выбрав. */
export async function showExportMenu(anchor: MenuAnchor): Promise<CanvasExportFormat | null> {
  const items: MenuItem<CanvasExportFormat>[] = [
    { action: 'pdf', label: 'PDF document', icon: <FileText /> },
    { action: 'pptx', label: 'PowerPoint presentation', icon: <Presentation /> },
    { action: 'png', label: 'PNG images', icon: <FileImage /> }
  ]
  return showMenu(items, anchor)
}

type ShareAction = 'copy' | 'open' | 'update' | 'stop'

/** Меню опубликованного холста: ссылка, обновление снимка (всех страниц), закрытие. */
export async function showShareMenu(anchor: MenuAnchor): Promise<ShareAction | null> {
  const items: MenuItem<ShareAction>[] = [
    { action: 'copy', label: 'Copy link', icon: <Copy /> },
    { action: 'open', label: 'Open in browser', icon: <ArrowUpRight /> },
    { action: 'update', label: 'Update shared version', icon: <RefreshCw /> },
    { type: 'separator' },
    { action: 'stop', label: 'Stop sharing', icon: <Unlink />, destructive: true }
  ]
  return showMenu(items, anchor)
}

/**
 * Меню холста чата — одно и то же в сайдбаре, на странице холста и в списке. Архив и удаление
 * действуют на весь холст, со всеми страницами; `canvas` — любая его страница.
 */
export async function showCanvasMenu(
  canvas: Canvas,
  anchor: MenuAnchor,
  { withOpen, chatAvailable, navigation, onRename }: CanvasMenuOptions
): Promise<void> {
  const chat: MenuItem<CanvasAction> = {
    action: 'chat',
    label: 'Go to chat',
    icon: <MessageCircle />,
    enabled: chatAvailable
  }
  const rename: MenuItem<CanvasAction>[] = onRename
    ? [{ action: 'rename', label: 'Rename page', icon: <Pencil /> }]
    : []
  // В списке и в сайдбаре холст сначала открывают; на его странице первым идёт переименование.
  const items: MenuItem<CanvasAction>[] = [
    ...(withOpen
      ? [{ action: 'open' as const, label: 'Open', icon: <ArrowUpRight /> }, chat]
      : [...rename, chat]),
    { type: 'separator' },
    canvas.archived
      ? { action: 'archive', label: 'Unarchive', icon: <ArchiveRestore /> }
      : { action: 'archive', label: 'Archive', icon: <Archive /> },
    { action: 'remove', label: 'Delete canvas…', icon: <Trash2 />, destructive: true }
  ]
  switch (await showMenu(items, anchor)) {
    case 'open':
      navigation.openChatCanvas(canvas.chatId)
      break
    case 'chat':
      navigation.openChat(canvas.chatId)
      break
    case 'rename':
      onRename?.()
      break
    case 'archive':
      void window.atox.canvas.archive(canvas.id, !canvas.archived)
      break
    case 'remove':
      void window.atox.canvas.removeCanvas(canvas.chatId)
      break
  }
}
