import type { Canvas } from '../../../shared/canvas'
import type { Chat, Project } from '../../../shared/models'

/** Проект и чат холста; чата нет, если его удалили или убрали в архив. */
export interface CanvasOwner {
  project?: Project
  chat?: Chat
}

export function canvasOwner(
  projects: readonly Project[],
  canvas: Pick<Canvas, 'chatId' | 'projectId'>
): CanvasOwner {
  const project = projects.find(({ id }) => id === canvas.projectId)
  const chat = project?.chats.find(({ id }) => id === canvas.chatId)
  return { ...(project && { project }), ...(chat && { chat }) }
}

/** Подпись вместо названия чата, которого больше нет. */
export const CHAT_DELETED_LABEL = 'Chat deleted'

/** Подпись чата холста: его название, а если чата больше нет — пометка об этом. */
export function chatLabel(owner: CanvasOwner): string {
  return owner.chat ? owner.chat.title : CHAT_DELETED_LABEL
}
