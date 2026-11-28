import type { AtoxApi } from '../../shared/api'

declare global {
  /** Название и версия приложения из package.json — подставляются при сборке. */
  const __APP_NAME__: string
  const __APP_VERSION__: string
  /** Сборка для разработчика (`ATOX_DEV_BUILD=1`): обновления выключены. */
  const __DEV_BUILD__: boolean
  /** Короткий хеш коммита и ветка сборки для разработчика; в релизной сборке пусто. */
  const __BUILD_COMMIT__: string
  const __BUILD_BRANCH__: string

  interface Window {
    atox: AtoxApi
  }
}
