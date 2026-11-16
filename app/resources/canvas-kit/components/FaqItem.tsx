import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'

export interface FaqItemProps {
  question: string
  answer: ReactNode
  /** Раскрыт при показе. */
  open?: boolean
}

/** Вопрос и ответ с раскрытием на нативном details. */
export function FaqItem({ question, answer, open }: FaqItemProps) {
  return (
    <details open={open} className="group border-b border-border py-5 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-base font-semibold text-fg">
        {question}
        <Plus aria-hidden size={18} strokeWidth={1.75} className="shrink-0 text-fg-subtle transition-transform group-open:rotate-45" />
      </summary>
      <div className="mt-3 max-w-2xl text-sm text-fg-muted">{answer}</div>
    </details>
  )
}
