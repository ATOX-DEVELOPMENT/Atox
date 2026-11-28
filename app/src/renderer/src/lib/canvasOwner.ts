import { isStandaloneCanvas, type Canvas } from '../../../shared/canvas'
import type { Chat, Project } from '../../../shared/models'

/**
 * Проект и чат холста; чата нет, если его удалили или убрали в архив, или если холст создан
 * без чата (`standalone`).
 */
export interface CanvasOwner {
  project?: Project
  chat?: Chat
  /** Холст создан без чата, и чат к нему ещё не привязан. */
  standalone: boolean
}

export function canvasOwner(
  projects: readonly Project[],
  canvas: Pick<Canvas, 'chatId' | 'projectId'>
): CanvasOwner {
  const project = projects.find(({ id }) => id === canvas.projectId)
  const chat = project?.chats.find(({ id }) => id === canvas.chatId)
  return {
    ...(project && { project }),
    ...(chat && { chat }),
    standalone: isStandaloneCanvas(canvas)
  }
}

/** Подпись вместо названия чата, которого больше нет. */
export const CHAT_DELETED_LABEL = 'Chat deleted'

/** Подпись вместо названия чата у холста, который создан без чата. */
export const NO_CHAT_LABEL = 'No chat'

/** Подпись чата холста: его название, а если чата нет — почему. */
export function chatLabel(owner: CanvasOwner): string {
  return owner.chat ? owner.chat.title : owner.standalone ? NO_CHAT_LABEL : CHAT_DELETED_LABEL
}
