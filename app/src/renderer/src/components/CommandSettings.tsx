import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import {
  PROMPT_TEMPLATE_LIMITS,
  normalizeTemplateName,
  promptTemplateError,
  type PromptTemplate
} from '../../../shared/slashCommands'
import { useSettings } from '../hooks/SettingsContext'

const { atox } = window

const EMPTY_TEMPLATE: PromptTemplate = { name: '', description: '', prompt: '' }

/**
 * Раздел «Commands»: свои слеш-команды. «/имя» в поле ввода подставляет текст промпта, который
 * можно дописать перед отправкой.
 */
export function CommandSettings() {
  const { promptTemplates } = useSettings()
  // Какую команду редактируют: индекс в списке, `'new'` — новую, `null` — никакую.
  const [editing, setEditing] = useState<number | 'new' | null>(null)

  const save = (templates: PromptTemplate[]) => {
    void atox.settings.update({ promptTemplates: templates })
    setEditing(null)
  }

  return (
    <div className="settings__group">
      <div className="settings__subgroup">
        <h2 className="settings__subgroup-title">Your commands</h2>
        <div className="settings__card">
          {promptTemplates.length === 0 && editing !== 'new' && (
            <div className="settings__row">
              <span className="settings__description">No commands yet.</span>
            </div>
          )}
          {promptTemplates.map((template, index) =>
            editing === index ? (
              <CommandEditor
                key={template.name}
                initial={template}
                others={promptTemplates.filter((_, other) => other !== index)}
                onCancel={() => setEditing(null)}
                onSave={(edited) =>
                  save(promptTemplates.map((item, other) => (other === index ? edited : item)))
                }
              />
            ) : (
              <div key={template.name} className="settings__row command-row">
                <span className="settings__label">
                  <span className="command-row__name">/{template.name}</span>
                  <span className="settings__description command-row__summary">
                    {template.description || template.prompt}
                  </span>
                </span>
                <span className="command-row__actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Edit /${template.name}`}
                    title="Edit"
                    disabled={editing !== null}
                    onClick={() => setEditing(index)}
                  >
                    <Pencil className="icon" />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Delete /${template.name}`}
                    title="Delete"
                    disabled={editing !== null}
                    onClick={() => save(promptTemplates.filter((_, other) => other !== index))}
                  >
                    <Trash2 className="icon" />
                  </button>
                </span>
              </div>
            )
          )}
          {editing === 'new' && (
            <CommandEditor
              initial={EMPTY_TEMPLATE}
              others={promptTemplates}
              onCancel={() => setEditing(null)}
              onSave={(created) => save([...promptTemplates, created])}
            />
          )}
        </div>
        {editing === null && promptTemplates.length < PROMPT_TEMPLATE_LIMITS.maxCount && (
          <button
            type="button"
            className="settings__button command-settings__add"
            onClick={() => setEditing('new')}
          >
            <Plus className="icon" />
            New command
          </button>
        )}
        <p className="settings__note">
          Type <code>/</code> in a chat to pick a command. Its prompt goes into the message field,
          so you can add details before sending.
        </p>
      </div>
    </div>
  )
}

interface CommandEditorProps {
  initial: PromptTemplate
  /** Остальные команды: имя не должно их повторять. */
  others: readonly PromptTemplate[]
  onCancel(): void
  onSave(template: PromptTemplate): void
}

function CommandEditor({ initial, others, onCancel, onSave }: CommandEditorProps) {
  const [template, setTemplate] = useState(initial)
  // Ошибку показывают после первой попытки сохранить: пустая форма не должна сразу ругаться.
  const [tried, setTried] = useState(false)
  const error = promptTemplateError(template, others)
  const change = (patch: Partial<PromptTemplate>) => setTemplate({ ...template, ...patch })

  const submit = () => {
    setTried(true)
    if (error === null) {
      onSave({
        name: normalizeTemplateName(template.name),
        description: template.description.trim(),
        prompt: template.prompt.trim()
      })
    }
  }

  return (
    <form
      className="settings__row settings__row--stacked command-editor"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onCancel()
        } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault()
          submit()
        }
      }}
    >
      <div className="command-editor__fields">
        <label className="command-editor__field">
          <span>Name</span>
          <span className="command-editor__name">
            <span className="command-editor__slash">/</span>
            <input
              className="settings__text-input"
              value={template.name}
              placeholder="review"
              maxLength={PROMPT_TEMPLATE_LIMITS.nameMaxLength}
              autoFocus
              spellCheck={false}
              onChange={(event) => change({ name: event.target.value })}
            />
          </span>
        </label>
        <label className="command-editor__field command-editor__field--wide">
          <span>Description</span>
          <input
            className="settings__text-input"
            value={template.description}
            placeholder="Shown next to the command (optional)"
            maxLength={PROMPT_TEMPLATE_LIMITS.descriptionMaxLength}
            onChange={(event) => change({ description: event.target.value })}
          />
        </label>
      </div>
      <label className="command-editor__field command-editor__field--wide">
        <span>Prompt</span>
        <textarea
          className="settings__text-input command-editor__prompt"
          value={template.prompt}
          placeholder="What the agent should do"
          rows={5}
          maxLength={PROMPT_TEMPLATE_LIMITS.promptMaxLength}
          onChange={(event) => change({ prompt: event.target.value })}
        />
      </label>
      <div className="command-editor__footer">
        <span className="settings__note command-editor__error" role={tried && error ? 'alert' : undefined}>
          {tried && error}
        </span>
        <button type="button" className="settings__button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="settings__button settings__button--primary">
          Save
        </button>
      </div>
    </form>
  )
}
