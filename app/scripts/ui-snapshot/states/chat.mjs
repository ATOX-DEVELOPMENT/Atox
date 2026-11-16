/**
 * Чат и сайдбар: записи ленты (ответ, разрешение, вопрос, сжатие, ошибка, отчёты, смена агента,
 * вложения, очередь), поле ввода (текст, выбор модели, команды) и сайдбар (кнопки значками,
 * скрытый, меню проекта и чата, пространства, архив, выбор значка).
 *
 * Чаты и проект Harbor — из `fixtures/extra-chat.mjs`. Состояния «агент работает», «ждёт
 * разрешения» и «ждёт ответа» настоящие: сообщение уходит встроенному Claude Code, а тот ходит
 * на поддельный API из того же файла.
 */

const PROJECT = 'Harbor'

/** Чаты, которые открывались раньше, остаются в окне скрытыми: ищем только в чате в фокусе. */
const PANE = '.chat-pane[data-focused="true"]'

/**
 * Часть состояний меняет профиль приложения (пространство, настройку), а он живёт в main-процессе
 * и переживает перезагрузку окна. Скрипт, зарегистрированный здесь, выполняется при каждой
 * следующей загрузке окна и возвращает прежнее значение, чтобы следующие состояния — в том числе
 * чужие — начинались как обычно.
 */
async function restoreOnReload(window, restore) {
  await window.send('Page.enable')
  // `window.atox` появляется чуть позже начала документа: ждём его.
  const source = `{ const timer = setInterval(() => { if (window.atox) { clearInterval(timer); ${restore} } }, 5) }`
  await window.send('Page.addScriptToEvaluateOnNewDocument', { source })
}

const RESTORE_MAIN_SPACE = `window.atox.spaces.setActive('space-main')`

/** Строка проекта в сайдбаре; клик раскрывает его чаты. */
async function expandProject(window, name = PROJECT) {
  // Предыдущее состояние могло оставить открытым другое пространство.
  const present = await window.evaluate(
    `[...document.querySelectorAll('.row--project')].some((row) => row.textContent.includes(${JSON.stringify(name)}))`
  )
  if (!present) {
    await window.click('.space-tab', { text: 'Main' })
    await window.waitFor('.row--project')
    await window.sleep(400)
  }
  const expanded = await window.evaluate(
    `[...document.querySelectorAll('.row--project')].some((row) => row.textContent.includes(${JSON.stringify(name)}) && row.querySelector('[aria-expanded="true"]'))`
  )
  if (!expanded) {
    await window.click('.row--project .row__label', { text: name })
    await window.sleep(400)
  }
}

/** Открывает чат проекта Harbor по названию и ждёт, пока лента загрузится. */
async function openChat(window, title) {
  await expandProject(window)
  await window.click('.row--chat .row__label', { text: title })
  await window.waitFor(`${PANE} .composer__input`)
  await window.sleep(700)
  await window.scrollToEnd(`${PANE} .chat-view__scroll`)
}

/** Отправляет сообщение из поля ввода настоящими нажатиями. */
async function send(window, message) {
  await window.click(`${PANE} .composer__input`)
  await window.type(message)
  await window.key('Enter')
}

/** Ждёт, пока условие в окне станет истинным. */
async function waitUntil(window, expression, timeout = 30000) {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    if (await window.evaluate(expression)) {
      return
    }
    await window.sleep(150)
  }
  await window.screenshot('/tmp/atox-shots-9341/debug-timeout.png')
  throw new Error(`Timed out waiting for ${expression}`)
}

/** Секундомер работающего агента каждую секунду другой: фиксируем его, чтобы снимок не менялся. */
async function freezeClock(window, label = '(24s · ↓ 1.3k tokens)') {
  await window.evaluate(`(() => {
    const meta = document.querySelector('.chat-pane[data-focused="true"] .turn-status__meta')
    if (meta) meta.textContent = ${JSON.stringify(label)}
  })()`)
}

/** Правый клик по строке: открывает контекстное меню. */
async function rightClick(window, selector, text) {
  await window.click(selector, { text, button: 'right' })
  await window.waitFor('.menu')
  await window.sleep(250)
}

/** Состояние окна «как после запуска»: чат из демо-профиля, а не пустая страница. */
const chat = (id, title, chatTitle, extra = {}) => ({
  id,
  title,
  async run(window) {
    await openChat(window, chatTitle)
    await extra.after?.(window)
  }
})

export const states = [
  // --- Записи ленты -----------------------------------------------------------------------
  chat('chat-answer', 'Chat: answer with code and table', 'Fix double webhook retries'),
  chat('chat-approval-allowed', 'Chat: approval allowed', 'Clean up the old build'),
  chat('chat-approval-denied', 'Chat: approval denied', 'Reset the staging database'),
  chat('chat-question-answered', 'Chat: agent question answered', 'Add a retry policy'),
  chat('chat-compaction', 'Chat: compaction', 'Event flow walkthrough'),
  chat('chat-error', 'Chat: error line', 'Run the integration suite'),
  chat('chat-context', 'Chat: context report', 'Context report'),
  chat('chat-limits', 'Chat: usage limits', 'Usage limits'),
  chat('chat-agent-switch', 'Chat: agent switch', 'Split the delivery worker'),
  chat('chat-attachments', 'Chat: message with attachments', 'Flat delivery chart'),
  chat('chat-queued', 'Chat: queued messages', 'Migrate the delivery log'),

  // --- Агент работает: настоящий Claude Code и поддельный API -----------------------------
  {
    id: 'chat-working',
    title: 'Chat: agent working (steps expanded)',
    async run(window) {
      await openChat(window, 'Trace the double retries')
      await send(window, 'Find out why the webhook retries fire twice.')
      // Все четыре шага (поиск и три чтения) выполнены, агент пишет ответ.
      await waitUntil(window, `!!document.querySelector('${PANE} .timeline')?.textContent.includes('Found it')`)
      await waitUntil(window, `!!document.querySelector('${PANE} .turn-status[data-working]:not(:disabled)')`)
      await window.click(`${PANE} .turn-status[data-working]`)
      await waitUntil(window, `document.querySelectorAll('${PANE} .activity-row').length >= 4`)
      await window.sleep(500)
      await window.scrollToEnd(`${PANE} .chat-view__scroll`)
      await freezeClock(window)
    }
  },
  {
    id: 'chat-approval',
    title: 'Chat: approval request pending',
    async run(window) {
      await openChat(window, 'Remove stale build output')
      await send(window, 'Clean up the stale build output before we ship.')
      await waitUntil(window, `!!document.querySelector('${PANE} .approval__button--allow')`)
      await window.sleep(500)
      await window.scrollToEnd(`${PANE} .chat-view__scroll`)
      await freezeClock(window, '(3s · ↓ 180 tokens)')
    }
  },
  {
    id: 'chat-question',
    title: 'Chat: agent question pending',
    async run(window) {
      await openChat(window, 'Choose a retry strategy')
      await send(window, 'Which retry strategy should we use for the webhook sender?')
      await waitUntil(window, `!!document.querySelector('${PANE} .question__option')`)
      await window.click(`${PANE} .question__option`, { text: 'Exponential backoff' })
      await window.sleep(300)
      await window.scrollToEnd(`${PANE} .chat-view__scroll`)
      await freezeClock(window, '(3s · ↓ 180 tokens)')
    }
  },

  // --- Пустые страницы --------------------------------------------------------------------
  {
    id: 'chat-empty',
    title: 'Chat: new empty chat',
    async run(window) {
      // Пустой чат из профиля — то же, что даёт кнопка «New chat»: ни одного сообщения.
      await expandProject(window)
      await window.click('.row--chat .row__label', { text: 'New chat' })
      await window.waitFor(`${PANE} .chat-view[data-empty="true"]`)
      await window.sleep(600)
    }
  },
  {
    id: 'chat-empty-workspace',
    title: 'Workspace: no chat open',
    async run(window) {
      // В пространстве Work нет открытого чата: рабочая область пуста, виден только знак Atox.
      await window.click('.space-tab', { text: 'Work' })
      await restoreOnReload(window, RESTORE_MAIN_SPACE)
      await window.waitFor('.workspace__empty')
      await window.sleep(900)
    }
  },

  // --- Поле ввода -------------------------------------------------------------------------
  {
    id: 'chat-composer-typed',
    title: 'Composer: focused with typed text',
    async run(window) {
      await openChat(window, 'Delivery worker overview')
      await window.click(`${PANE} .composer__input`)
      await window.type(
        'Explain how a failed delivery ends up in the dead-letter list,\nand which setting controls how long it stays there.'
      )
      await window.sleep(300)
    }
  },
  {
    id: 'chat-composer-attachment',
    title: 'Composer: pasted image attached',
    async run(window) {
      await openChat(window, 'Delivery worker overview')
      await window.click(`${PANE} .composer__input`)
      // Картинка вставляется из буфера обмена, как у пользователя; рисуется тут же на холсте.
      await window.evaluate(`(async () => {
        const canvas = document.createElement('canvas')
        canvas.width = 320
        canvas.height = 200
        const context = canvas.getContext('2d')
        const gradient = context.createLinearGradient(0, 0, 320, 200)
        gradient.addColorStop(0, '#2f7dff')
        gradient.addColorStop(1, '#a24dff')
        context.fillStyle = gradient
        context.fillRect(0, 0, 320, 200)
        context.fillStyle = 'rgba(255,255,255,0.9)'
        context.fillRect(40, 120, 240, 14)
        context.fillRect(40, 90, 160, 14)
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
        const data = new DataTransfer()
        data.items.add(new File([blob], 'delivery-chart.png', { type: 'image/png' }))
        document.activeElement.dispatchEvent(
          new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
        )
      })()`)
      await waitUntil(window, `!!document.querySelector('.composer__attachment[data-kind="image"]')`, 8000)
      await window.type('What do you see in this chart?')
      await window.sleep(400)
    }
  },
  {
    id: 'chat-model-picker',
    title: 'Composer: model picker open',
    async run(window) {
      await openChat(window, 'Delivery worker overview')
      await window.click(`${PANE} .model-picker`)
      await window.waitFor('.menu')
      await window.sleep(400)
    }
  },
  {
    id: 'chat-model-picker-effort',
    title: 'Composer: effort submenu',
    async run(window) {
      await openChat(window, 'Delivery worker overview')
      await window.click(`${PANE} .model-picker`)
      await window.waitFor('.menu')
      await window.hover('.menu__item', 'Effort')
      await window.sleep(500)
    }
  },
  {
    id: 'chat-slash-menu',
    title: 'Composer: slash command menu',
    async run(window) {
      await openChat(window, 'Delivery worker overview')
      await window.click(`${PANE} .composer__input`)
      await window.type('/')
      await window.waitFor('.command-menu__item', 20000)
      await window.sleep(400)
    }
  },
  {
    id: 'chat-slash-filtered',
    title: 'Composer: slash menu filtered',
    async run(window) {
      await openChat(window, 'Delivery worker overview')
      await window.click(`${PANE} .composer__input`)
      await window.type('/co')
      await window.waitFor('.command-menu__item', 20000)
      await window.sleep(400)
    }
  },

  // --- Сайдбар ----------------------------------------------------------------------------
  {
    id: 'chat-split',
    title: 'Chat: two chats side by side',
    async run(window) {
      await openChat(window, 'Fix double webhook retries')
      // Раскладка проекта сохраняется в профиле: возвращаем один чат при следующей загрузке окна.
      await restoreOnReload(window, `window.atox.projects.setSplit('p-harbor', null)`)
      await rightClick(window, '.row--chat', 'Delivery worker overview')
      await window.click('.menu__item', { text: 'Open to the Side' })
      await window.waitFor('.chat-pane__header')
      await window.sleep(900)
    }
  },
  {
    id: 'chat-sidebar-workers',
    title: 'Sidebar: chat with agents and a fork',
    async run(window) {
      await openChat(window, 'Fix double webhook retries')
      await window.waitFor('.chat-workers__toggle')
    }
  },
  {
    id: 'chat-sidebar-icons',
    title: 'Sidebar: top buttons as icons',
    async run(window) {
      await openChat(window, 'Fix double webhook retries')
      await window.evaluate(`window.atox.settings.update({ sidebarButtons: 'icons' })`)
      await window.waitFor('.sidebar__nav[data-style="icons"]')
      // Настройка живёт в профиле: возвращаем «список» при следующей загрузке окна,
      // чтобы следующие состояния (в том числе чужие) не остались с иконками.
      await restoreOnReload(window, `window.atox.settings.update({ sidebarButtons: 'list' })`)
      await window.sleep(500)
    }
  },
  {
    id: 'chat-sidebar-hidden',
    title: 'Sidebar: hidden',
    async run(window) {
      await openChat(window, 'Fix double webhook retries')
      await window.click('button[aria-label="Hide sidebar"]')
      await window.waitFor('.app[data-sidebar="hidden"]')
      await window.sleep(600)
    }
  },
  {
    id: 'chat-project-menu',
    title: 'Sidebar: project context menu',
    async run(window) {
      await rightClick(window, '.row--project', PROJECT)
    }
  },
  {
    id: 'chat-project-color',
    title: 'Sidebar: project color submenu',
    async run(window) {
      await rightClick(window, '.row--project', PROJECT)
      await window.hover('.menu__item', 'Color')
      await window.sleep(500)
    }
  },
  {
    id: 'chat-project-move',
    title: 'Sidebar: move project to a space',
    async run(window) {
      await rightClick(window, '.row--project', PROJECT)
      await window.hover('.menu__item', 'Move to Space')
      await window.sleep(500)
    }
  },
  {
    id: 'chat-icon-picker',
    title: 'Sidebar: project icon picker',
    async run(window) {
      await rightClick(window, '.row--project', PROJECT)
      await window.click('.menu__item', { text: 'Icon' })
      await window.sleep(700)
    }
  },
  {
    id: 'chat-project-rename',
    title: 'Sidebar: renaming a project',
    async run(window) {
      await rightClick(window, '.row--project', PROJECT)
      await window.click('.menu__item', { text: 'Rename' })
      await window.waitFor('.row--project input')
      await window.sleep(300)
    }
  },
  {
    id: 'chat-chat-menu',
    title: 'Sidebar: chat context menu',
    async run(window) {
      await expandProject(window)
      await rightClick(window, '.row--chat', 'Clean up the old build')
    }
  },
  {
    id: 'chat-space-menu',
    title: 'Sidebar: space context menu',
    async run(window) {
      await rightClick(window, '.space-tab', 'Work')
    }
  },
  {
    id: 'chat-space-work',
    title: 'Sidebar: Work space',
    async run(window) {
      await window.click('.space-tab', { text: 'Work' })
      await restoreOnReload(window, RESTORE_MAIN_SPACE)
      await window.click('.row--project .row__label', { text: 'Billing API' })
      await window.click('.row--chat .row__label', { text: 'Add webhook retries' })
      await window.waitFor('.chat-view')
      await window.sleep(800)
    }
  },
  {
    id: 'chat-archived',
    title: 'Settings: archived chats',
    async run(window) {
      await window.click('button[aria-label="Settings"]')
      await window.waitFor('.settings')
      await window.click('.settings__tabs [role="tab"]', { text: 'Archive' })
      await window.waitFor('.archived__list')
      await window.sleep(400)
    }
  }
]
