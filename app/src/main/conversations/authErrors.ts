/**
 * Ошибки входа Claude Code: сохранённый вход истёк и не обновился, ключа нет или он неверный.
 * Их текст приходит от Claude Code как есть — например, «Failed to authenticate: OAuth session
 * expired and could not be refreshed» или «Invalid API key · Please run /login».
 */
const AUTH_ERROR =
  /failed to authenticate|authentication[_ ](?:error|failed)|oauth[\w ]*(?:expired|revoked|invalid)|could not be refreshed|invalid api key|invalid (?:x-api-key|bearer token|authentication credentials)|please run \/login|run \/login|not logged in|log ?in required|\b401\b|unauthori[sz]ed/i

/** Ошибка хода, после которой поможет войти в аккаунт заново. */
export function isAuthError(message: string): boolean {
  return AUTH_ERROR.test(message)
}
