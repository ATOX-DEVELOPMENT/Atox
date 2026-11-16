/**
 * Настройки и страницы вокруг них: разделы настроек, горячие клавиши, обновления, обзор
 * агентов, лимиты в сайдбаре, смена имени, светлая тема и другой акцент.
 */

/** Открывает страницу настроек кнопкой в профиле сайдбара. */
async function openSettings(window) {
  await window.click('button[aria-label="Settings"]')
  await window.waitFor('.settings')
  await window.sleep(300)
}

/** Открывает раздел настроек по вкладке. */
async function openSection(window, label) {
  await openSettings(window)
  await window.click('.settings__tabs [role="tab"]', { text: label })
  await window.sleep(400)
}

/** Ждёт, пока оба агента ответят: ни одна карточка не показывает «Loading…». */
async function waitForLists(window, timeout = 20000) {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    const loading = await window.evaluate(
      `[...document.querySelectorAll('.integrations__message')].some((el) => /Loading|Connecting/.test(el.textContent))`
    )
    if (!loading) {
      await window.sleep(300)
      return
    }
    await window.sleep(300)
  }
  throw new Error('Integration lists did not load')
}

/** Страница настроек, прокрученная до заголовка раздела (общая страница длиннее окна). */
async function scrollToHeading(window, title) {
  await window.evaluate(`(() => {
    const heading = [...document.querySelectorAll('.settings__subgroup-title')].find((el) => el.textContent === ${JSON.stringify(title)})
    heading?.scrollIntoView({ block: 'start' })
  })()`)
  await window.sleep(300)
}

/**
 * Тема, акцент и «показать лимиты» переживают перезагрузку окна (настройки приложения и
 * localStorage), поэтому после скриншота окна — последнего шага состояния — возвращаем их:
 * следующие состояния, и чужие группы, не должны получить светлую тему или открытые лимиты.
 */
function restoreAfterShot(window) {
  const screenshot = window.screenshot
  window.screenshot = async (file) => {
    window.screenshot = screenshot
    await screenshot(file)
    await window.evaluate(`localStorage.removeItem('atox.limitsShown')`)
    await window.evaluate(`window.atox.settings.update({ theme: 'system', accent: 'blue' })`)
    await window.sleep(400)
  }
}

export const states = [
  {
    id: 'settings-general',
    title: 'Settings: General',
    async run(window) {
      await openSettings(window)
    }
  },
  {
    id: 'settings-usage',
    title: 'Settings: Usage',
    async run(window) {
      await openSection(window, 'Usage')
      await window.waitFor('.usage-agent')
    }
  },
  {
    id: 'settings-github',
    title: 'Settings: GitHub',
    async run(window) {
      await openSection(window, 'GitHub')
      await window.waitFor('.github-account')
    }
  },
  {
    id: 'settings-plugins',
    title: 'Settings: Plugins',
    async run(window) {
      await openSection(window, 'Plugins')
      await waitForLists(window)
    }
  },
  {
    id: 'settings-skills',
    title: 'Settings: Skills',
    async run(window) {
      await openSection(window, 'Skills')
      await waitForLists(window)
    }
  },
  {
    id: 'settings-mcp',
    title: 'Settings: MCP servers',
    async run(window) {
      await openSection(window, 'MCP')
      await waitForLists(window, 30000)
    }
  },
  {
    id: 'settings-archive',
    title: 'Settings: Archive',
    async run(window) {
      await openSection(window, 'Archive')
      await window.waitFor('.settings .settings__card')
    }
  },
  {
    id: 'settings-shortcuts',
    title: 'Settings: Shortcuts',
    async run(window) {
      await openSettings(window)
      await scrollToHeading(window, 'Chats')
    }
  },
  {
    id: 'settings-shortcut-recording',
    title: 'Settings: Recording a shortcut',
    async run(window) {
      await openSettings(window)
      await window.click('button.shortcut-keys--editable')
      await window.waitFor('button.shortcut-keys--editable[data-recording="true"]')
    }
  },
  {
    id: 'settings-update-unsupported',
    title: 'Settings: Update unavailable here',
    async run(window) {
      await openSettings(window)
      await window.click('.settings__button', { text: 'Check for Updates' })
      await window.waitFor('.settings__description[aria-live]', 4000)
      await window.sleep(2000)
    }
  },
  {
    id: 'settings-agents',
    title: 'Agents: nothing running',
    async run(window) {
      await window.click('.sidebar button', { text: 'Agents' })
      await window.waitFor('.agents')
      await window.sleep(800)
    }
  },
  {
    id: 'settings-plan-limits',
    title: 'Sidebar: plan limits',
    async run(window) {
      restoreAfterShot(window)
      await window.click('button[aria-label="Usage"]')
      await window.waitFor('.plan-limits-collapse[data-shown="true"] .plan-limits__window')
      await window.sleep(700)
    }
  },
  {
    id: 'settings-general-light',
    title: 'Settings: Light theme',
    async run(window) {
      restoreAfterShot(window)
      await openSettings(window)
      await window.click('[aria-label="Appearance"] [role="radio"]', { text: 'Light' })
      await window.sleep(800)
    }
  },
  {
    id: 'settings-general-rose',
    title: 'Settings: Rose accent',
    async run(window) {
      restoreAfterShot(window)
      await openSettings(window)
      await window.click('.accent-swatch[data-accent="rose"]')
      await window.sleep(500)
    }
  }
]
