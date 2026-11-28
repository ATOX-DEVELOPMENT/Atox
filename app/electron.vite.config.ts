import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import packageJson from './package.json'
import claudeSdkPackage from './node_modules/@anthropic-ai/claude-agent-sdk/package.json'

/**
 * Релизы лежат в закрытом репозитории, файлы отдаёт сайт Atox: `latest` — последний релиз,
 * `v<версия>/<файл>` — файл конкретного релиза.
 */
const updatesUrl = 'https://atox.dev/updates'
const updateFeedUrl = `${updatesUrl}/latest`
const releaseDownloadUrl = updatesUrl

/**
 * Версия Claude Code, на которую рассчитан его SDK: старее нет смысла запускать — лимиты и новые
 * модели у неё не работают. Atox запускает установленный у пользователя Claude Code и сравнивает.
 */
const claudeCodeMinimumVersion = claudeSdkPackage.claudeCodeVersion

/** Сервер анонимной статистики Atox (админка). */
const usageStatsUrl = 'https://admin.atox.dev/v1/event'

export default defineConfig({
  main: {
    define: {
      __UPDATE_FEED_URL__: JSON.stringify(updateFeedUrl),
      __RELEASE_DOWNLOAD_URL__: JSON.stringify(releaseDownloadUrl),
      __USAGE_STATS_URL__: JSON.stringify(usageStatsUrl),
      __CLAUDE_CODE_MIN_VERSION__: JSON.stringify(claudeCodeMinimumVersion)
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          // Команда `atox` для агентов: её запускает бинарник приложения в режиме Node.
          atox: resolve(__dirname, 'src/cli/atox.ts')
        },
        // Встроенный модуль Electron — файловые функции без поддержки asar.
        external: ['original-fs']
      }
    }
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src')
      }
    },
    define: {
      __APP_NAME__: JSON.stringify(packageJson.build.productName),
      __APP_VERSION__: JSON.stringify(packageJson.version)
    },
    plugins: [react()]
  }
})
