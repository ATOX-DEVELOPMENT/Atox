/**
 * Страницы, которым нужны данные: список холстов и страница холста («Fix», история), доска
 * задач с окном запуска и выбором репозиториев, страница репозитория (PR, issue), терминал и
 * панель изменений. Данные — в `fixtures/extra-workspace.mjs`.
 *
 * Два последних состояния меняют данные приложения (убирают все холсты и репозитории с доски):
 * они стоят в конце файла, чтобы остальные видели полные данные.
 */

/**
 * Открывает чат проекта. Раскрытый проект сайдбар помнит между перезагрузками, поэтому, если
 * строки чата не видно, сначала раскрываем проект.
 */
async function openChat(window, project, title) {
  const visible = `(() => {
    const row = [...document.querySelectorAll('.row__label')].find((node) => node.textContent.includes(${JSON.stringify(title)}))
    return !!row && !row.closest('[inert]')
  })()`
  if (!(await window.evaluate(visible))) {
    await window.click('.row__label', { text: project })
    await window.sleep(400)
  }
  await window.click('.row__label', { text: title })
  await window.waitFor('.chat-view__scroll')
}

async function openSidebarPage(window, label) {
  await window.click('.sidebar-button', { text: label })
}

// --- Холсты ----------------------------------------------------------------------------------

async function openCanvasList(window) {
  await openSidebarPage(window, 'Canvases')
  await window.waitFor('.canvas-card')
  await window.sleep(500)
}

/** Убирает холсты из списка действующих — как если бы пользователь заархивировал каждый. */
async function archiveAllCanvases(window) {
  await window.evaluate(`(async () => {
    const ids = ${JSON.stringify(['cv-checkout', 'cv-onboarding', 'cv-dashboard'])}
    for (const id of ids) await window.atox.canvas.archive(id, true)
  })()`)
  await window.sleep(300)
}

async function openCheckoutCanvas(window) {
  await openCanvasList(window)
  await window.click('.canvas-card__open[aria-label="Open Checkout redesign"]')
  await window.waitFor('.canvas-screen')
  // Экраны — iframe: ждём, пока они загрузятся и холст впишет их в окно.
  await window.sleep(2000)
}

// --- Доска -----------------------------------------------------------------------------------

/** Настоящий клик по элементу внутри карточки доски (кнопка видна, пока мышь над карточкой). */
async function clickInCard(window, title, selector) {
  const point = await window.evaluate(`(() => {
    const card = [...document.querySelectorAll('.board-card')].find((node) => node.textContent.includes(${JSON.stringify(title)}))
    const box = card?.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect()
    return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null
  })()`)
  if (!point) {
    throw new Error(`No ${selector} in the card "${title}"`)
  }
  await window.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point })
  for (const type of ['mousePressed', 'mouseReleased']) {
    await window.send('Input.dispatchMouseEvent', { type, ...point, button: 'left', buttons: 1, clickCount: 1 })
  }
  await window.sleep(300)
}

async function openBoard(window) {
  await openSidebarPage(window, 'Board')
  await window.waitFor('.board-card')
  // Очередь отдаёт задачи агентам: ждём, пока две из них перейдут в Progress.
  await window.sleep(2500)
}

// --- Репозиторий -----------------------------------------------------------------------------

async function openRepository(window) {
  await openChat(window, 'Fern', 'Fix the checkout total rounding')
  await openSidebarPage(window, 'Repository')
  await window.waitFor('.repository__list', 15000)
  await window.sleep(400)
}

/**
 * xterm рисует текст в WebGL-холст — в снимок DOM он не попадает. Поэтому настоящий вывод
 * оболочки (его отдаёт main-процесс) кладётся в разметку строк xterm (`.xterm-rows`) на место холста.
 */
async function drawTerminalRows(window) {
  // Функция выполняется в окне: сериализуется целиком, без замыканий.
  const draw = async () => {
    const output = await window.atox.terminals.attach('p-fern', { cols: 60, rows: 50 })
    const text = output
      .replace(/\u001b\][^\u0007\u001b]*(\u0007|\u001b\\)/g, '')
      .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
      .replace(/\u001b[=>]/g, '')
      .replace(/.\u0008/g, '')
      .replace(/\r/g, '')
    const lines = text.split('\n').map((line) => line.replace(/\s+$/, '').replace(/^\s+(?=\S+ % )/, ''))
    while (lines.length && lines[lines.length - 1] === '') lines.pop()
    const screen = document.querySelector('.xterm-screen')
    screen.querySelectorAll('canvas').forEach((canvas) => canvas.remove())
    const rows = document.createElement('div')
    rows.className = 'xterm-rows'
    rows.style.cssText = 'font: 12px/15px Menlo, monospace; color: rgb(229,229,229); white-space: pre'
    for (const line of lines.slice(-50)) {
      const row = document.createElement('div')
      const prompt = /^(\S+) % (.*)$/.exec(line)
      if (prompt) {
        row.innerHTML = '<span class="xterm-fg-4"></span><span> % </span><span></span>'
        row.children[0].style.color = 'rgb(96, 150, 255)'
        row.children[0].textContent = prompt[1]
        row.children[2].textContent = prompt[2]
      } else {
        row.textContent = line || ' '
      }
      rows.append(row)
    }
    screen.prepend(rows)
    return lines
  }
  const lines = await window.evaluate(`(${draw.toString()})()`)
  await window.sleep(200)
}

export const states = [
  {
    id: 'workspace-canvas-list',
    title: 'Canvases: active',
    async run(window) {
      await openCanvasList(window)
    }
  },
  {
    id: 'workspace-canvas-archived',
    title: 'Canvases: archived',
    async run(window) {
      await openCanvasList(window)
      await window.click('.segmented [role="tab"]', { text: 'Archived' })
      await window.sleep(300)
    }
  },
  {
    id: 'workspace-canvas-search',
    title: 'Canvases: search',
    async run(window) {
      await openCanvasList(window)
      await window.click('input[aria-label="Search canvases"]')
      await window.type('check')
      await window.sleep(300)
    }
  },
  {
    id: 'workspace-canvas-card-menu',
    title: 'Canvases: card menu',
    async run(window) {
      await openCanvasList(window)
      await window.click('.canvas-card__menu[aria-label="More actions for Checkout redesign"]')
      await window.waitFor('.menu')
    }
  },
  {
    id: 'workspace-canvas-page',
    title: 'Canvas: screens',
    async run(window) {
      await openCheckoutCanvas(window)
    }
  },
  {
    id: 'workspace-canvas-screen-menu',
    title: 'Canvas: screen menu',
    async run(window) {
      await openCheckoutCanvas(window)
      await window.click('.canvas-screen__overlay[aria-label="Go to Payment"]', { button: 'right' })
      await window.waitFor('.menu')
    }
  },
  {
    id: 'workspace-canvas-fix',
    title: 'Canvas: Fix box',
    async run(window) {
      await openCheckoutCanvas(window)
      await window.click('.canvas-screen__overlay[aria-label="Go to Payment"]', { button: 'right' })
      await window.click('.menu__item', { text: 'Fix' })
      await window.waitFor('.request-box')
      await window.click('.request-box__field')
      await window.type('Make the pay button full width and add Apple Pay above the card')
      await window.sleep(400)
    }
  },
  {
    id: 'workspace-canvas-history',
    title: 'Canvas: history',
    async run(window) {
      await openCheckoutCanvas(window)
      await window.click('button[aria-label="History"]')
      await window.waitFor('.history-drawer .version')
      await window.sleep(400)
    }
  },
  {
    id: 'workspace-board',
    title: 'Board',
    // Пять колонок в окне 1200 px не помещаются: Review и Done видны при ширине 1700.
    size: [1700, 780],
    async run(window) {
      await window.resize(1700, 780)
      await window.sleep(300)
      await openBoard(window)
    }
  },
  {
    id: 'workspace-board-card-menu',
    title: 'Board: card menu',
    async run(window) {
      await openBoard(window)
      await window.click('.board-card', { text: 'Dashboard query takes 4 s', button: 'right' })
      await window.waitFor('.menu')
    }
  },
  {
    id: 'workspace-board-start',
    title: 'Board: start task',
    async run(window) {
      await openBoard(window)
      await window.hover('.board-card', 'Dashboard query takes 4 s')
      await clickInCard(window, 'Dashboard query takes 4 s', '.board-card__action')
      await window.waitFor('.start-task')
      await window.sleep(300)
    }
  },
  {
    id: 'workspace-board-repositories',
    title: 'Board: repositories',
    async run(window) {
      await openBoard(window)
      await window.click('.board__button', { text: 'Repositories' })
      await window.waitFor('.repo-picker__row')
      await window.sleep(400)
    }
  },
  {
    id: 'workspace-repo-pulls',
    title: 'Repository: pull requests',
    async run(window) {
      await openRepository(window)
    }
  },
  {
    id: 'workspace-repo-pulls-closed',
    title: 'Repository: closed pull requests',
    async run(window) {
      await openRepository(window)
      await window.click('[role="radio"]', { text: 'Closed' })
      await window.sleep(300)
    }
  },
  {
    id: 'workspace-repo-issues',
    title: 'Repository: issues',
    async run(window) {
      await openRepository(window)
      await window.click('.segmented [role="tab"]', { text: 'Issues' })
      await window.sleep(400)
    }
  },
  {
    id: 'workspace-repo-filter',
    title: 'Repository: filter',
    async run(window) {
      await openRepository(window)
      await window.click('input[aria-label="Filter"]')
      await window.type('checkout')
      await window.sleep(400)
    }
  },
  {
    id: 'workspace-repo-not-git',
    title: 'Repository: not a git project',
    async run(window) {
      // Проект Notes — не git-репозиторий: открываем его чат, а потом страницу репозитория.
      await openChat(window, 'Notes', 'Sync notes between devices')
      await openSidebarPage(window, 'Repository')
      await window.waitFor('.repository__message--error', 15000)
      await window.sleep(300)
    }
  },
  {
    id: 'workspace-terminal',
    title: 'Terminal',
    async run(window) {
      await openChat(window, 'Fern', 'Fix the checkout total rounding')
      await window.click('button[aria-label="Open terminal"]')
      await window.waitFor('.xterm')
      await window.sleep(1500)
      for (const command of ['git status --short', 'ls src/checkout', 'git diff --stat']) {
        await window.type(command)
        await window.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 })
        await window.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
        await window.sleep(900)
      }
      await drawTerminalRows(window)
    }
  },
  {
    id: 'workspace-changes',
    title: 'Changes: diff',
    async run(window) {
      await openChat(window, 'Fern', 'Fix the checkout total rounding')
      await window.click('button[aria-label="Show changes"]')
      await window.waitFor('.changed-file')
      await window.click('.changed-file__toggle, .changed-file button, .changed-file')
      await window.sleep(800)
    }
  },
  // Состояния ниже меняют данные приложения и поэтому стоят последними.
  {
    id: 'workspace-canvas-empty',
    title: 'Canvases: empty',
    async run(window) {
      await archiveAllCanvases(window)
      await openSidebarPage(window, 'Canvases')
      await window.waitFor('.canvas-list__empty')
      await window.sleep(300)
    }
  },
  {
    id: 'workspace-board-empty',
    title: 'Board: no repositories',
    async run(window) {
      await window.evaluate('window.atox.board.setRepositories([])')
      await openSidebarPage(window, 'Board')
      await window.waitFor('.board__empty')
      await window.sleep(300)
    }
  }
]
