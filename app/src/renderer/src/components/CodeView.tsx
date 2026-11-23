import { useEffect, useRef } from 'react'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, highlightActiveLine, lineNumbers } from '@codemirror/view'
import { HighlightStyle, LanguageDescription, syntaxHighlighting } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { tags } from '@lezer/highlight'

/** Цвета берутся из CSS-переменных: подсветка сама следует светлой и тёмной теме окна. */
const HIGHLIGHT = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword], color: 'var(--code-keyword)' },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: 'var(--code-string)' },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: 'var(--code-number)' },
  { tag: [tags.comment, tags.meta], color: 'var(--code-comment)', fontStyle: 'italic' },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: 'var(--code-function)'
  },
  { tag: [tags.typeName, tags.className, tags.namespace], color: 'var(--code-type)' },
  { tag: [tags.propertyName, tags.attributeName], color: 'var(--code-property)' },
  { tag: [tags.tagName, tags.heading], color: 'var(--code-property)', fontWeight: '600' },
  { tag: [tags.operator, tags.punctuation], color: 'var(--code-operator)' },
  { tag: tags.link, textDecoration: 'underline' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: '600' }
])

const THEME = EditorView.theme({
  '&': { height: '100%', fontSize: '12.5px', backgroundColor: 'transparent' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--color-text-muted)',
    border: 'none'
  },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 12px 0 8px', minWidth: '32px' },
  '.cm-activeLine': { backgroundColor: 'var(--color-hover)' },
  '.cm-content': { caretColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--color-selection) !important'
  }
})

interface CodeViewProps {
  path: string
  content: string
}

/** Файл только для чтения: номера строк и подсветка по расширению. */
export function CodeView({ path, content }: CodeViewProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) {
      return
    }
    const language = new Compartment()
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: content,
        extensions: [
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          lineNumbers(),
          highlightActiveLine(),
          syntaxHighlighting(HIGHLIGHT),
          THEME,
          language.of([])
        ]
      })
    })
    // Грамматики подгружаются по требованию: в сборку попадают только те, что открывали.
    let disposed = false
    void LanguageDescription.matchFilename(languages, path)
      ?.load()
      .then((support) => {
        if (!disposed) {
          view.dispatch({ effects: language.reconfigure(support) })
        }
      })
      .catch(() => undefined)
    return () => {
      disposed = true
      view.destroy()
    }
  }, [path, content])

  return <div ref={hostRef} className="code-view" />
}
