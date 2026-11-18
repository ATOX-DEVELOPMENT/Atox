import type { Canvas } from '../../../shared/canvas'

/** Холст чата: все его страницы, в их порядке. */
export interface ChatCanvas {
  chatId: string
  projectId: string
  /** Страницы холста, хотя бы одна. */
  pages: readonly Canvas[]
  archived: boolean
  /** Когда правили в последний раз любую из страниц. */
  updatedAt: number
  screenCount: number
}

/** Страницы, собранные в холсты чатов; порядок — по первой странице каждого холста. */
export function chatCanvases(pages: readonly Canvas[]): ChatCanvas[] {
  const byChat = new Map<string, Canvas[]>()
  for (const page of pages) {
    const own = byChat.get(page.chatId)
    if (own) {
      own.push(page)
    } else {
      byChat.set(page.chatId, [page])
    }
  }
  return [...byChat.values()].flatMap((own) => {
    const [first] = own
    return first
      ? [
          {
            chatId: first.chatId,
            projectId: first.projectId,
            pages: own,
            archived: own.every(({ archived }) => archived),
            updatedAt: Math.max(...own.map(({ updatedAt }) => updatedAt)),
            screenCount: own.reduce((total, page) => total + page.screens.length, 0)
          }
        ]
      : []
  })
}
