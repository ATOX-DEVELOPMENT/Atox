import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Globe } from 'lucide-react'
import type { LinkPreview } from '../../../shared/linkPreview'
import type { IssueState, PullRequestState } from '../../../shared/repository'
import { CHECKS_LOOK, ISSUE_LOOK, PULL_REQUEST_LOOK, REVIEW_LABEL } from '../lib/githubStates'

/** Сколько держать указатель на ссылке, прежде чем показать карточку: мимоходом — не надо. */
const HOVER_DELAY_MS = 450
/** Отступ карточки от ссылки и от краёв окна. */
const CARD_GAP_PX = 6

interface Shown {
  anchor: DOMRect
  preview: LinkPreview
}

/**
 * Карточка ссылки при наведении. Возвращает обработчики для ссылки и саму карточку.
 * Карточку спрашиваем только после задержки наведения; не вышло — её просто нет.
 */
export function useLinkPreview(href: string | undefined, chatId: string | undefined) {
  const [shown, setShown] = useState<Shown | null>(null)
  // Номер наведения: ответ на прошлое наведение не должен открыть карточку после ухода.
  const hover = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const hide = () => {
    hover.current++
    clearTimeout(timer.current)
    setShown(null)
  }

  const onMouseEnter = (event: MouseEvent<HTMLElement>) => {
    if (!href) {
      return
    }
    const element = event.currentTarget
    const current = ++hover.current
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      window.atox.links
        .preview(href, chatId)
        .then((preview) => {
          if (preview && hover.current === current && element.isConnected) {
            setShown({ anchor: element.getBoundingClientRect(), preview })
          }
        })
        .catch(() => {})
    }, HOVER_DELAY_MS)
  }

  // Открытая карточка закрывается по Esc и при прокрутке: она привязана к месту ссылки.
  useEffect(() => {
    if (!shown) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && hide()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', hide, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', hide, true)
    }
  }, [shown])

  useEffect(() => () => clearTimeout(timer.current), [])

  return {
    anchorProps: { onMouseEnter, onMouseLeave: hide, onClick: hide },
    card: shown && <LinkPreviewCard anchor={shown.anchor} preview={shown.preview} />
  }
}

/** Компактная карточка: значок, заголовок и строка подробностей — под ссылкой или над ней. */
function LinkPreviewCard({ anchor, preview }: { anchor: DOMRect; preview: LinkPreview }) {
  const cardRef = useRef<HTMLDivElement>(null)
  // Размер карточки известен только после отрисовки: до этого она невидима.
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card) {
      return
    }
    const { offsetWidth: width, offsetHeight: height } = card
    const left = Math.max(
      CARD_GAP_PX,
      Math.min(anchor.left, window.innerWidth - CARD_GAP_PX - width)
    )
    const fitsBelow = anchor.bottom + CARD_GAP_PX + height + CARD_GAP_PX <= window.innerHeight
    const top = fitsBelow ? anchor.bottom + CARD_GAP_PX : anchor.top - CARD_GAP_PX - height
    setPosition({ left, top: Math.max(CARD_GAP_PX, top) })
  }, [anchor])

  return createPortal(
    <div
      ref={cardRef}
      className="link-preview"
      role="tooltip"
      style={{
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        visibility: position ? undefined : 'hidden'
      }}
    >
      {preview.kind === 'github' ? (
        <GitHubPreview preview={preview} />
      ) : (
        <PagePreview preview={preview} />
      )}
    </div>,
    document.body
  )
}

function GitHubPreview({ preview }: { preview: Extract<LinkPreview, { kind: 'github' }> }) {
  const look =
    preview.type === 'pull-request'
      ? PULL_REQUEST_LOOK[preview.state as PullRequestState]
      : ISSUE_LOOK[preview.state as IssueState]
  const checks = preview.checks && CHECKS_LOOK[preview.checks]
  const open = preview.state === 'open' || preview.state === 'draft'
  const details = [
    `${preview.repository} #${preview.number}`,
    look.label,
    preview.author,
    checks && checks.label,
    open && preview.review && REVIEW_LABEL[preview.review]
  ].filter(Boolean)
  return (
    <>
      <span className="link-preview__icon" data-tone={look.tone}>
        <look.icon className="icon" aria-hidden />
      </span>
      <span className="link-preview__text">
        <span className="link-preview__title">{preview.title}</span>
        <span className="link-preview__meta">{details.join(' · ')}</span>
      </span>
    </>
  )
}

function PagePreview({ preview }: { preview: Extract<LinkPreview, { kind: 'page' }> }) {
  return (
    <>
      <span className="link-preview__icon">
        {preview.icon ? (
          <img className="link-preview__favicon" src={preview.icon} alt="" />
        ) : (
          <Globe className="icon" aria-hidden />
        )}
      </span>
      <span className="link-preview__text">
        <span className="link-preview__title">{preview.title}</span>
        {preview.description && (
          <span className="link-preview__description">{preview.description}</span>
        )}
        <span className="link-preview__meta">{preview.site}</span>
      </span>
    </>
  )
}
