import { Archive, ArchiveRestore, ArrowUpRight, MessageCircle, Pencil, Trash2 } from 'lucide-react'
import type { Canvas } from '../../../shared/canvas'
import type { CanvasNavigation } from '../hooks/CanvasesContext'
import { showMenu, type MenuAnchor, type MenuItem } from './menu'

type CanvasAction = 'open' | 'chat' | 'rename' | 'archive' | 'remove'

interface CanvasMenuOptions {
  /** Пункт «Open»: в списке холстов и в сайдбаре; на странице самого холста его нет. */
  withOpen: boolean
  /** Чат холста ещё есть — к нему можно перейти. */
  chatAvailable: boolean
  /** Подпись переименования: на странице холста уточняется, что меняется имя холста. */
  renameLabel?: string
  navigation: CanvasNavigation
  /** Включает переименование там, где открыто меню. */
  onRename(): void
}

/** Меню холста — одно и то же в сайдбаре, на его странице и в списке холстов. */
export async function showCanvasMenu(
  canvas: Canvas,
  anchor: MenuAnchor,
  { withOpen, chatAvailable, renameLabel = 'Rename', navigation, onRename }: CanvasMenuOptions
): Promise<void> {
  const items: MenuItem<CanvasAction>[] = [
    ...(withOpen ? [{ action: 'open' as const, label: 'Open', icon: <ArrowUpRight /> }] : []),
    {
      action: 'chat',
      label: 'Go to chat',
      icon: <MessageCircle />,
      enabled: chatAvailable
    },
    { action: 'rename', label: renameLabel, icon: <Pencil /> },
    { type: 'separator' },
    canvas.archived
      ? { action: 'archive', label: 'Unarchive', icon: <ArchiveRestore /> }
      : { action: 'archive', label: 'Archive', icon: <Archive /> },
    { action: 'remove', label: 'Delete…', icon: <Trash2 />, destructive: true }
  ]
  switch (await showMenu(items, anchor)) {
    case 'open':
      navigation.openCanvas(canvas.id)
      break
    case 'chat':
      navigation.openChat(canvas.chatId)
      break
    case 'rename':
      onRename()
      break
    case 'archive':
      void window.atox.canvas.archive(canvas.id, !canvas.archived)
      break
    case 'remove':
      void window.atox.canvas.remove(canvas.id)
      break
  }
}
