import { useSyncExternalStore, type MouseEvent } from 'react'
import {
  Check,
  Download,
  Ellipsis,
  History,
  LayoutDashboard,
  LoaderCircle,
  Scan,
  Share2
} from 'lucide-react'
import { CANVAS_NAME_MAX_LENGTH, type Canvas } from '../../../../shared/canvas'
import type { CanvasOwner } from '../../lib/canvasOwner'
import { InlineRename } from '../InlineRename'
import type { ViewState } from './viewState'

interface CanvasHeaderProps {
  canvas: Canvas
  owner: CanvasOwner
  viewState: ViewState
  renaming: boolean
  onRenamingChange(renaming: boolean): void
  historyOpen: boolean
  onToggleHistory(): void
  onFit(): void
  onResetZoom(): void
  /** Выгрузка экранов идёт: кнопка занята. */
  exporting: boolean
  onExport(event: MouseEvent<HTMLButtonElement>): void
  /** Ссылка публикуется сейчас, и ссылка только что скопирована в буфер. */
  publishing: boolean
  linkCopied: boolean
  onShare(event: MouseEvent<HTMLButtonElement>): void
  onOpenMenu(event: MouseEvent<HTMLButtonElement>): void
}

/** Шапка холста: имя, проект, чат, масштаб и кнопки вида. */
export function CanvasHeader({
  canvas,
  owner,
  viewState,
  renaming,
  onRenamingChange,
  historyOpen,
  onToggleHistory,
  onFit,
  onResetZoom,
  exporting,
  onExport,
  publishing,
  linkCopied,
  onShare,
  onOpenMenu
}: CanvasHeaderProps) {
  const hasScreens = canvas.screens.length > 0

  return (
    <header className="canvas-header">
      <h1 className="canvas-header__title">
        <LayoutDashboard className="icon canvas-header__icon" aria-hidden />
        {renaming ? (
          <InlineRename
            value={canvas.name}
            label="Page name"
            onSubmit={(name) => {
              onRenamingChange(false)
              void window.atox.canvas.rename(canvas.id, name.slice(0, CANVAS_NAME_MAX_LENGTH))
            }}
            onCancel={() => onRenamingChange(false)}
          />
        ) : (
          <button
            type="button"
            className="canvas-header__name"
            title="Rename page"
            onClick={() => onRenamingChange(true)}
          >
            {canvas.name}
          </button>
        )}
      </h1>
      {owner.project && <span className="canvas-header__project">{owner.project.name}</span>}
      {canvas.archived && <span className="canvas-header__badge">Archived</span>}

      <div className="canvas-header__actions">
        {hasScreens && (
          <>
            <ZoomButton viewState={viewState} onClick={onResetZoom} />
            <button
              type="button"
              className="workspace-toolbar__button"
              aria-label="Fit all screens"
              title="Fit all screens"
              onClick={onFit}
            >
              <Scan className="icon" />
            </button>
            <button
              type="button"
              className="workspace-toolbar__button"
              disabled={exporting}
              aria-label="Export"
              title={exporting ? 'Exporting…' : 'Export this page as PDF, PowerPoint or images'}
              onClick={onExport}
            >
              {exporting ? (
                <LoaderCircle className="icon canvas-header__export-spinner" />
              ) : (
                <Download className="icon" />
              )}
            </button>
            <button
              type="button"
              className="workspace-toolbar__button"
              data-active={canvas.share !== null}
              disabled={publishing}
              aria-label="Share"
              title={
                publishing
                  ? 'Publishing…'
                  : linkCopied
                    ? 'Link copied'
                    : canvas.share
                      ? 'Shared: copy the link, update or stop sharing'
                      : 'Share a link to view this canvas, all pages, in a browser'
              }
              onClick={onShare}
            >
              {publishing ? (
                <LoaderCircle className="icon canvas-header__export-spinner" />
              ) : linkCopied ? (
                <Check className="icon" />
              ) : (
                <Share2 className="icon" />
              )}
            </button>
            <button
              type="button"
              className="workspace-toolbar__button"
              data-active={historyOpen}
              aria-pressed={historyOpen}
              aria-label="History"
              title="History"
              onClick={onToggleHistory}
            >
              <History className="icon" />
            </button>
          </>
        )}
        <button
          type="button"
          className="workspace-toolbar__button"
          aria-label="More"
          title="More"
          onClick={onOpenMenu}
        >
          <Ellipsis className="icon" />
        </button>
      </div>
    </header>
  )
}

/** Масштаб в процентах; клик возвращает 100%. Перерисовывается сам, без страницы холста. */
function ZoomButton({ viewState, onClick }: { viewState: ViewState; onClick(): void }) {
  const percent = useSyncExternalStore(viewState.subscribe, viewState.zoomPercent)
  return (
    <button
      type="button"
      className="canvas-header__zoom"
      aria-label={percent === null ? 'Zoom' : `Zoom ${percent}%, reset to 100%`}
      title="Reset to 100%"
      onClick={onClick}
    >
      {percent === null ? '' : `${percent}%`}
    </button>
  )
}
