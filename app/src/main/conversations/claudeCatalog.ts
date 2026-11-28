import type { ModelInfo } from '@anthropic-ai/claude-agent-sdk'
import type { AgentCatalog, AgentModel } from '../../shared/conversation'

/** Строка списка моделей, которая означает «модель по умолчанию», а не отдельную модель. */
const DEFAULT_MODEL_ALIAS = 'default'

/** Полные идентификаторы закреплённых версий — в отличие от общих названий вроде `opus`. */
const PINNED_MODEL_PREFIX = 'claude-'

/**
 * Модель API: `claude-<семейство>-<major>[-<minor>][-<дата>]` — `claude-opus-5-5`,
 * `claude-sonnet-5`, `claude-haiku-4-5-20251001`. Дата из восьми цифр — не номер версии.
 */
const MODEL_ID = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?$/

interface ModelVersion {
  family: string
  major: number
  minor: number
}

function modelVersion(id: string | undefined): ModelVersion | null {
  const match = id === undefined ? null : MODEL_ID.exec(id)
  return match && { family: match[1], major: Number(match[2]), minor: Number(match[3] ?? 0) }
}

/** Сравнение версий одного семейства: больше нуля — `left` новее. */
function compareVersions(left: ModelVersion, right: ModelVersion): number {
  return left.major - right.major || left.minor - right.minor
}

function isPinned(model: ModelInfo): boolean {
  return model.value.startsWith(PINNED_MODEL_PREFIX)
}

/**
 * Строки для основного меню — по одной на семейство: его самая новая версия. Под общим
 * названием (`opus`), если оно указывает на неё, иначе под закреплённым id: Claude Code бывает
 * отдаёт новую версию только так, пока общее название ещё ведёт на прежнюю. Прежние версии и
 * отставшие от семейства названия уходят в подменю. Если Claude Code не сказал, на какую
 * модель указывает строка, решает её вид: общее название — в меню, закреплённый id — в подменю.
 */
function primaryModels(models: readonly ModelInfo[]): Set<string> {
  const primary = new Set<string>()
  const newest = new Map<string, { version: ModelVersion; model: ModelInfo }>()
  for (const model of models) {
    const version = modelVersion(model.resolvedModel)
    if (!version) {
      if (!isPinned(model)) {
        primary.add(model.value)
      }
      continue
    }
    const best = newest.get(version.family)
    const order = best ? compareVersions(version, best.version) : 1
    if (order > 0 || (order === 0 && best && isPinned(best.model) && !isPinned(model))) {
      newest.set(version.family, { version, model })
    }
  }
  newest.forEach(({ model }) => primary.add(model.value))
  return primary
}

/** Список моделей Claude Code для меню выбора модели. */
export function toCatalog(models: ModelInfo[]): AgentCatalog {
  const alias = models.find(({ value }) => value === DEFAULT_MODEL_ALIAS)
  const listed = models.filter(({ value }) => value !== DEFAULT_MODEL_ALIAS)
  const primary = primaryModels(listed)
  // «По умолчанию» — не модель, а ссылка на одну из них: показываем ту, на которую она указывает,
  // и лучше строку основного меню, чем её же закреплённую копию в подменю.
  const pointed = listed.filter(
    ({ resolvedModel }) => resolvedModel !== undefined && resolvedModel === alias?.resolvedModel
  )
  const defaultModel =
    (pointed.find(({ value }) => primary.has(value)) ?? pointed[0] ?? listed[0])?.value ??
    DEFAULT_MODEL_ALIAS
  return {
    agent: 'claude',
    defaultModel,
    // Без аккаунта Claude Code отдаёт только общие названия: ни прежних моделей, ни версий.
    ...(!listed.some(isPinned) && { incomplete: true }),
    models: listed.map(
      (model): AgentModel => ({
        id: model.value,
        name: model.displayName,
        efforts: model.supportedEffortLevels ?? [],
        ...(!primary.has(model.value) && { secondary: true })
      })
    )
  }
}
