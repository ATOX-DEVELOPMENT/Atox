/**
 * Переписки демо-профиля: id чата → ленты. Формат — `TimelineItem` из `src/shared/conversation.ts`.
 * Новые состояния чата добавляют сюда (и чат — в `projects.mjs`).
 */
const HOUR = 3_600_000
const base = Date.UTC(2026, 10, 16, 9, 0, 0)

let counter = 0
const id = () => `i-${String(++counter).padStart(4, '0')}`

const user = (text, minutes, extra = {}) => ({
  kind: 'user',
  id: id(),
  text,
  agent: 'claude',
  createdAt: base + minutes * 60_000,
  finishedAt: base + minutes * 60_000 + 95_000,
  ...extra
})
const assistant = (text) => ({ kind: 'assistant', id: id(), text })
const tool = (kind, name, title, output, status = 'done') => ({
  kind: 'tool',
  id: id(),
  tool: kind,
  name,
  title,
  ...(output !== undefined && { output }),
  status
})

export const conversations = {
  /** Основной чат: правка с поиском, чтением, правкой, тестами и итогом. */
  'c-fern-checkout': [
    user(
      'The checkout total is off by a cent when a discount is applied. Can you find out why and fix it?',
      0
    ),
    assistant("I'll start with how the total is calculated."),
    tool('search', 'Grep', 'toFixed|Math.round in src/checkout', 'src/checkout/total.ts:18\nsrc/checkout/format.ts:7'),
    tool(
      'read',
      'Read',
      'src/checkout/total.ts',
      'export function orderTotal(lines: Line[], discount: number): number {\n  const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0)\n  return Number((subtotal * (1 - discount)).toFixed(2))\n}'
    ),
    assistant(
      'Found it. The discount is applied to the **whole subtotal as a float**, then rounded once at the end. With a 15% discount on `$19.99 × 3` the float result is `50.9745`, which rounds to `50.97`, but the invoice rounds every line first and gets `50.98`.\n\nTwo ways to fix it:\n\n- Round each discounted line to cents, then sum (matches the invoice).\n- Keep everything in integer cents and format only at the edge.\n\nI will go with integer cents: it also removes the `toFixed` calls in `format.ts`.'
    ),
    tool('edit', 'Edit', 'src/checkout/total.ts', '+  const cents = (value: number) => Math.round(value * 100)\n-  return Number((subtotal * (1 - discount)).toFixed(2))\n+  return lines.reduce((sum, line) => sum + Math.round(cents(line.price) * line.qty * (1 - discount)), 0) / 100'),
    tool('command', 'Bash', 'npm test -- total', ' PASS  src/checkout/total.test.ts\n  ✓ applies a percentage discount per line (3 ms)\n  ✓ keeps totals in whole cents (1 ms)\n  ✓ handles a 100% discount (1 ms)\n\nTest Suites: 1 passed, 1 total\nTests:       12 passed, 12 total'),
    assistant(
      'The total now matches the invoice: `$19.99 × 3` with 15% off is `$50.98`.\n\n**What changed**\n\n1. `orderTotal` works in integer cents and rounds each discounted line once.\n2. Added three tests: per-line rounding, whole-cent totals and a 100% discount.\n\nAll 12 tests pass.'
    )
  ],
  /** Короткий чат с вопросом о коде. */
  'c-fern-dark': [
    user('Add a dark mode toggle to the settings screen.', 40),
    assistant(
      "Settings already reads the theme from `useTheme()`, so I'll add a three-way control (System, Light, Dark) next to the language picker and persist it with the other preferences."
    ),
    tool('edit', 'Edit', 'src/settings/Appearance.tsx', '+<SegmentedControl value={theme} onChange={setTheme} options={THEMES} />'),
    assistant('Done. The toggle sits under **Appearance** and the choice survives a restart.')
  ]
}
