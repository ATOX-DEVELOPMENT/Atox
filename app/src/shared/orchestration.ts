/**
 * Протокол, по которому агенты в терминалах Atox управляют приложением через команду `atox`:
 * запускают помощников в соседних чатах, переписываются с ними и получают отчёты.
 * Команда подключается к локальному сокету приложения и отправляет одну строку JSON.
 */

/** Переменные окружения, которые получает терминал каждого чата. */
export const OrchestrationEnv = {
  /** Путь к сокету приложения. */
  Socket: 'ATOX_SOCKET',
  /** Секрет запуска приложения: без него сокет не принимает команды. */
  Token: 'ATOX_TOKEN',
  /** Чат, из терминала которого вызвана команда. */
  ChatId: 'ATOX_CHAT_ID',
  /** Полный путь к команде `atox` — на случай, если профиль оболочки переписал PATH. */
  Cli: 'ATOX_CLI'
} as const

/** Адресат сообщения помощника — агент, который его запустил. */
export const PARENT_ADDRESS = 'parent'

export interface AgentInfo {
  id: string
  name: string
}

/** Модель агента, которую можно дать помощнику. */
export interface WorkerModelInfo {
  id: string
  name: string
  /** Уровни эффорта модели; пусто — выбора нет. */
  efforts: string[]
  /** Эффорт модели, если его не выбрали. */
  defaultEffort?: string
}

export interface WorkerInfo {
  chatId: string
  title: string
  agent: string
  /** Терминал помощника работает. */
  running: boolean
  /** Модель и эффорт помощника; нет — по умолчанию у агента. */
  model?: string
  effort?: string
  /** Помощник уже прислал отчёт. */
  reported: boolean
  /** Когда помощника запустили, мс с начала эпохи. */
  startedAt: number
}

/** Экран на холсте чата, как его видит агент. */
export interface CanvasScreenInfo {
  name: string
  /** Устройство из списка холста или `custom` — свой размер. */
  device: string
  width: number
  height: number
  /** Абсолютный путь к HTML-файлу экрана. */
  file: string
  /** Файла нет или он не читается: холст показывает последнюю сохранённую версию. */
  missing: boolean
  /** Экран-React не собирается: «файл:строка: что не так»; `null` — собирается. */
  buildError: string | null
}

/** Команды и их параметры/результаты. */
export interface OrchestrationMethods {
  agents: { params: Record<string, never>; result: AgentInfo[] }
  /** Модели агента и эффорты каждой — из них выбирают `model` и `effort` для `start`. */
  models: {
    params: { agent: string }
    result: { defaultModel: string; models: WorkerModelInfo[] }
  }
  start: {
    /** `model` и `effort` не заданы — те, с которыми пользователь начинает новые чаты. */
    params: { agent: string; task: string; title?: string; model?: string; effort?: string }
    result: { chatId: string; title: string; model?: string; effort?: string }
  }
  send: { params: { to: string; message: string }; result: { chatId: string } }
  report: { params: { summary: string }; result: { chatId: string } }
  workers: { params: Record<string, never>; result: WorkerInfo[] }
  /** Останавливает помощников и убирает их чаты из списка. */
  remove: { params: { chatIds: string[] }; result: { removed: string[] } }
  /** Холст чата, его экраны и стрелки между ними; `null` — холста у чата нет. */
  canvas: {
    params: Record<string, never>
    result: {
      name: string
      screens: CanvasScreenInfo[]
      links: { from: string; to: string; label: string | null; on: string | null }[]
    } | null
  }
  /**
   * Ставит на холст чата экран из файла (HTML или React-компонент) или обновляет экран с тем же именем (без учёта
   * регистра). Холста нет — он создаётся. `file` — абсолютный путь (.html, .tsx, .jsx), `size` — `WxH`.
   */
  canvasScreenSet: {
    params: { name: string; file: string; device?: string; size?: string }
    result: {
      canvas: string
      screen: string
      canvasCreated: boolean
      created: boolean
      device: string
      width: number
      height: number
      file: string
      /** Проблемы раскладки словами; пусто — всё помещается или измерить не удалось. */
      layout: string[]
      /** Экран-React не собрался: «файл:строка: что не так»; `null` — собрался. */
      buildError: string | null
      /** Ошибки страницы при открытии: необработанные исключения, `console.error`. */
      runtimeErrors: string[]
    }
  }
  /** Снимает экран в PNG, как он выглядит на холсте, и проверяет раскладку. */
  canvasScreenPreview: {
    params: { name: string }
    result: {
      screen: string
      path: string
      layout: string[]
      buildError: string | null
      runtimeErrors: string[]
    }
  }
  /**
   * Ставит стрелку между двумя экранами (по именам): что за чем идёт. С `on` стрелка начинается
   * у кнопки экрана `from` (её текст или CSS-селектор). Та же пара и кнопка обновляют подпись.
   */
  canvasLinkSet: {
    params: { from: string; to: string; label?: string; on?: string }
    result: {
      from: string
      to: string
      label: string | null
      on: string | null
      created: boolean
      elementMissing: boolean
    }
  }
  /** Убирает стрелки между экранами; с `on` — только от этой кнопки. */
  canvasLinkRemove: {
    params: { from: string; to: string; on?: string }
    result: { removed: number }
  }
  /** Убирает экран с холста; HTML-файл остаётся. */
  canvasScreenRemove: { params: { name: string }; result: { screen: string } }
  /**
   * Выгружает экраны холста в PDF, PNG (папка) или PPTX: ряды сверху вниз, в ряду слева направо.
   * `screens` — имена; не заданы — все. `out` — абсолютный путь; не задан — папка «Загрузки».
   */
  canvasExport: {
    params: { format: string; screens?: string[]; out?: string }
    result: { path: string; format: string; screens: number; warnings: string[] }
  }
}

export type OrchestrationMethod = keyof OrchestrationMethods

export interface OrchestrationRequest<Method extends OrchestrationMethod = OrchestrationMethod> {
  token: string
  chatId: string
  method: Method
  params: OrchestrationMethods[Method]['params']
}

export type OrchestrationResponse<Method extends OrchestrationMethod = OrchestrationMethod> =
  { ok: true; result: OrchestrationMethods[Method]['result'] } | { ok: false; error: string }
