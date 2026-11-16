# Снимки интерфейса Atox для холста

Каждый экран приложения (и его состояния: открытое меню, диалог, пустая страница) снимается
с живого окна и пишется как React-экран холста: `.atox/canvas/app/<id>.tsx`. Внутри —
настоящие классы и настоящий `src/renderer/src/styles/global.css`, так что экран выглядит точь-в-точь
как в приложении, а новые идеи рисуются прямо поверх: копируешь экран, меняешь разметку.

## Как это работает

- `demo-profile.mjs` строит демо-профиль: выдуманные проекты, чаты, переписки (`fixtures/`),
  git-репозитории в `/tmp/atox-demo-<порт>`. Личных данных в снимках нет.
- `run.mjs` запускает **собранное** приложение (`npm run build`) с этим профилем и CDP-портом,
  для каждого состояния из `states/*.mjs` перезагружает окно, вызывает `run(window)`, снимает DOM
  (`dom-to-jsx.js`) и пишет экран. Без `--no-canvas` ставит экраны на холст чата.
- `harness.mjs` — управление окном: `click(selector, { text, button })` (настоящая мышь),
  `hover`, `type`, `key`, `waitFor`, `scrollToEnd`, `evaluate`, `sleep`.

## Запуск

```sh
cd app && npm run build                       # один раз (и после правок приложения)
node scripts/ui-snapshot/run.mjs --only chat,chat-approval --port 9341 --no-canvas
node scripts/ui-snapshot/run.mjs --place-only # поставить все готовые экраны на холст
```

У параллельных запусков свои `--port` (9333 по умолчанию) и профиль (`/tmp/atox-demo-profile-<порт>`).

## Новое состояние

Файл `states/<группа>.mjs` экспортирует `states`; группа — ряд на холсте:

```js
export const states = [
  {
    id: 'chat-approval',        // имя файла экрана, уникальное во всех группах
    title: 'Chat: approval',    // имя экрана на холсте
    size: [1200, 780],          // необязательно
    async run(window) {         // окно уже перезагружено, чат и страница — как после запуска
      await window.click('.row__label', { text: 'Fix the checkout total rounding' })
      await window.waitFor('.chat-view__scroll')
    }
  }
]
```

Данные, которых нет в базовом профиле (чат с вопросом агента, настройка, поддельный `gh`),
кладутся в `fixtures/extra-<группа>.mjs`: `export async function extend(context)` меняет
`context.projects`, `context.settings`, `context.conversations`, пишет файлы в
`context.userData` и может вернуть `{ env }` для приложения. Формат переписок — `TimelineItem` из
`src/shared/conversation.ts`; примеры — `fixtures/conversations.mjs`.

Классы и разметку смотрят в `src/renderer/src/components/*.tsx`.
