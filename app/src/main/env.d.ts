/** Адрес файлов последнего релиза на GitHub — подставляется при сборке из package.json. */
declare const __UPDATE_FEED_URL__: string
/** Файлы релизов по версиям: `<адрес>/v<версия>/<файл>`. */
declare const __RELEASE_DOWNLOAD_URL__: string
/** Адрес сервера анонимной статистики — подставляется при сборке. */
declare const __USAGE_STATS_URL__: string
/** Версия Claude Code, на которую рассчитан SDK, — подставляется при сборке. */
declare const __CLAUDE_CODE_MIN_VERSION__: string
/** Сборка для разработчика (`ATOX_DEV_BUILD=1`): обновления выключены. */
declare const __DEV_BUILD__: boolean
/** Короткий хеш коммита сборки для разработчика; в релизной сборке пусто. */
declare const __BUILD_COMMIT__: string
/** Ветка сборки для разработчика; в релизной сборке пусто. */
declare const __BUILD_BRANCH__: string
