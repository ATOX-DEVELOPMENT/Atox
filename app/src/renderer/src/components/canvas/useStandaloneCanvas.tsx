import { useCallback, useMemo } from 'react'
import { MessageCircle } from 'lucide-react'
import type { Canvas } from '../../../../shared/canvas'
import { useCanvasNavigation, useCanvases } from '../../hooks/CanvasesContext'
import { useProjectsContext } from '../../hooks/ProjectsContext'
import { showMenu, type MenuAnchor } from '../../lib/menu'

/** Что можно сделать с холстом без чата: привязать к чату или позвать к нему нового агента. */
export interface StandaloneCanvasActions {
  /** Меню чатов проекта без своего холста; выбранный чат получает холст. */
  linkChat(canvas: Canvas, anchor: MenuAnchor): Promise<void>
  /** Новый чат в проекте холста: холст привязывается к нему, и человек остаётся на холсте. */
  startAgent(canvas: Canvas): Promise<void>
}

export function useStandaloneCanvas(): StandaloneCanvasActions {
  const { projects, createChat } = useProjectsContext()
  const canvases = useCanvases()
  const navigation = useCanvasNavigation()

  const linkChat = useCallback(
    async (canvas: Canvas, anchor: MenuAnchor) => {
      const taken = new Set((canvases ?? []).map(({ chatId }) => chatId))
      const chats = (projects.find(({ id }) => id === canvas.projectId)?.chats ?? []).filter(
        ({ id }) => !taken.has(id)
      )
      const chatId = await showMenu<string>(
        chats.length > 0
          ? chats.map(({ id, title }) => ({ action: id, label: title, icon: <MessageCircle /> }))
          : [{ action: '', label: 'Every chat of this project has a canvas', enabled: false }],
        anchor
      )
      if (chatId) {
        await window.atox.canvas.linkChat(canvas.id, chatId)
      }
    },
    [canvases, projects]
  )

  const startAgent = useCallback(
    async (canvas: Canvas) => {
      const chatId = await createChat(canvas.projectId)
      await window.atox.canvas.linkChat(canvas.id, chatId)
      // Новый чат открылся сам; человек возвращается на холст и просит агента прямо отсюда.
      navigation.openCanvas(canvas.id)
    },
    [createChat, navigation]
  )

  return useMemo(() => ({ linkChat, startAgent }), [linkChat, startAgent])
}
