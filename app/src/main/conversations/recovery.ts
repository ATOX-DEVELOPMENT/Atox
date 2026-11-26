/**
 * Через сколько пробовать продолжить оборвавшийся ход — по попытке на задержку. Сеть обычно
 * возвращается за секунды, а упавший процесс агента перезапускается сразу.
 */
export const RECOVERY_DELAYS_MS: readonly number[] = [2_000, 5_000, 15_000]

/** Как часто проверять, вернулась ли сеть, пока её нет. */
export const NETWORK_CHECK_INTERVAL_MS = 3_000

/**
 * Что получает агент, когда ход продолжается после обрыва, если он уже начал отвечать:
 * исходное сообщение у него в разговоре, и второй раз его отправлять нельзя.
 */
export const CONTINUE_PROMPT =
  'The connection dropped in the middle of your previous reply, so it was cut off. ' +
  'Continue from where you stopped. Do not redo steps that already finished.'

/** Обрыв связи, перегруженный сервер или упавший процесс агента: повтор может помочь. */
const TRANSIENT_ERROR =
  /network|connection|socket|ECONN\w*|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ENETUNREACH|EPIPE|timed out|timeout|fetch failed|stream disconnected|error sending request|overloaded|server error|service unavailable|bad gateway|gateway timeout|\b50[0234]\b|\b529\b|process exited|exited with code|terminated|SIGKILL|SIGTERM/i

/**
 * Ошибки, которые повтор не исправит: нет входа, кончились лимиты или деньги, запрос
 * неверный. Проверяются первыми — «rate limit» тоже бывает с кодом 5xx в тексте.
 */
const PERMANENT_ERROR =
  /log ?in|sign(?:ed)? ?in|auth|api key|unauthori[sz]ed|forbidden|\b40[0134]\b|\b429\b|quota|usage limit|rate.?limit|billing|credit|payment|subscription|insufficient|not found|invalid/i

/** Ошибка хода, после которой его стоит продолжить самим, а не показывать пользователю. */
export function isTransientError(message: string): boolean {
  return TRANSIENT_ERROR.test(message) && !PERMANENT_ERROR.test(message)
}
