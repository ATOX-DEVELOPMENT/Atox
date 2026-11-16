/** Основной экран: чат, сайдбар и пустой чат. */
export const states = [
  {
    id: 'chat',
    title: 'Chat',
    async run(window) {
      await window.click('.row__label', { text: 'Fix the checkout total rounding' })
      await window.waitFor('.chat-view__scroll')
      await window.sleep(600)
      await window.scrollToEnd('.chat-view__scroll')
    }
  }
]
