# Atox canvas design kit (`@atox/ui`)

Read this before you design a screen. The kit gives you finished, polished components and a strict set of rules. A screen built from the kit and the rules below looks like a real product. A screen built from bare `div`s does not. Use the kit first, Tailwind classes second, custom markup last.

## 1. Imports

A screen is a `.tsx` file with a default export. Only these imports work:

```tsx
import { Button, Card, Screen } from '@atox/ui'       // the kit
import { Search, Plus } from 'lucide-react'           // icons (lucide 1.x, no brand logos)
import { useState } from 'react'                      // React 19
import { orders } from './data'                       // your own project files
```

No network, no `fetch`, no CDN, no web fonts, no external images. Images may only come from project files or data URIs. Styling is Tailwind CSS v4 classes plus the kit tokens below.

## 2. Devices and screen skeletons

| Device | Size | Root |
|---|---|---|
| iPhone | 390 x 844 | `<Screen>` + `StatusBar` + `NavBar` + `ScrollArea` + `TabBar` |
| Android | 412 x 915 | same as iPhone |
| Tablet | 820 x 1180 | `<Screen>` with `Sidebar` (collapsed) or `NavBar` + content |
| Desktop app | 1100 x 700 | `<Screen className="flex-row">` + `Sidebar` + column (`Topbar` + `ScrollArea`) |
| Website | 1280 x 800 | `<Screen layout="page">` + `SiteNav` + sections + `Footer` |

`Screen` fills the frame. `layout="app"` (default) keeps the frame height: header and bottom bar stay put and only `ScrollArea` scrolls. `layout="page"` lets a website grow downward. Never use `h-screen` or `100vh`.

```tsx
// Phone
<Screen>
  <StatusBar />
  <NavBar large title="Inbox" actions={<IconButton icon={SquarePen} label="Compose" size="lg" />} />
  <ScrollArea className="px-4 pb-6">...</ScrollArea>
  <TabBar items={tabs} defaultValue="inbox" />
</Screen>

// Desktop app
<Screen className="flex-row">
  <Sidebar header={<Brand name="Orbit" icon={Hexagon} size="sm" />}>...</Sidebar>
  <div className="flex min-w-0 flex-1 flex-col">
    <Topbar leading={<Breadcrumbs items={['Acme', 'Issues']} />} actions={...} />
    <ScrollArea className="bg-canvas-subtle"><div className="grid gap-6 p-6">...</div></ScrollArea>
  </div>
</Screen>
```

## 3. Strict design rules

Follow every rule. They are what separates a product from a wireframe.

1. **Spacing rhythm of 8px.** Use Tailwind steps 2, 4, 6, 8, 10, 12, 16 (8 to 64px) for gaps and padding; 1 and 3 (4px, 12px) only inside small controls. Page padding: phone `px-4` (16px) or `px-6`, desktop `p-6`, website sections `py-20` with `Container`.
2. **Two font weights per screen:** regular (400) for text and semibold (600) for headings, labels, buttons and numbers. Never use `font-bold`, `font-medium`, `font-light`. The kit already follows this.
3. **Type scale, nothing in between:**
   | Class | Size | Use |
   |---|---|---|
   | `text-2xs` | 11px | chart axes, tiny counters |
   | `text-xs` | 12px | captions, table headers, meta |
   | `text-sm` | 13px | desktop body and controls (default for apps) |
   | `text-base` | 15px | phone body, website body, list rows |
   | `text-lg` | 17px | lead paragraphs, phone nav titles |
   | `text-xl` / `text-2xl` | 20 / 24px | card titles, page titles in apps |
   | `text-3xl` / `text-4xl` | 30 / 36px | phone screen titles, website section titles |
   | `text-5xl` / `text-6xl` | 48 / 60px | website hero only |
   Large sizes already have tight tracking. Do not add `tracking-*`.
4. **One accent color.** Pick it with `<Screen accent="...">` (indigo by default, also blue, emerald, rose, amber, violet). Everything else is neutral grey. Status colors (success, warning, danger, info) are only for status, never decoration.
5. **One primary action per screen.** Exactly one `Button` with `variant="primary"` in view; other actions are `secondary` or `ghost`.
6. **Generous whitespace.** When in doubt, add space, remove borders. Group with spacing first, then cards, then dividers.
7. **Touch targets of 44px on phones.** Use `size="lg"` or `size="xl"` for buttons and inputs, `IconButton size="lg"`, list rows are already 48px. Desktop controls are 28 to 36px.
8. **Consistent radius.** Controls `rounded-md`, cards `rounded-xl`, dialogs and sheets `rounded-2xl`, pills `rounded-full`. Do not mix other values.
9. **Subtle borders over heavy shadows.** Cards are `border border-border` with `shadow-xs`. Use `shadow-lg` and `shadow-xl` only for floating things (menus, dialogs, toasts, a product mockup in a hero).
10. **Real content.** Real names (Maya Chen, Diego Morales), real products, plausible numbers ($84,210, 1,328, 4m 12s), real dates (Nov 16, 09:12). Never lorem ipsum, "Item 1", "User Name", "Title", "$0.00" everywhere or round placeholder numbers.
11. **All states.** Lists and tables need an empty state (`EmptyState` or `Table empty`). Forms show validation (`Field error`). Data screens deserve a loading variant (`Skeleton`). Show at least one state change when it matters (selected row, active tab, toast after an action).
12. **Icons from lucide only, 16px in desktop UI and 20px on phones, stroke 1.75.** Pass icons to kit props (`icon={Plus}`); the kit sizes them. For a loose icon use `<Icon icon={Plus} size={16} />`. One icon style per screen, no emoji.
13. **Alignment grid.** Left edges line up. Numbers in tables and stats are right aligned and `tabular-nums` (the kit does it). Section headers share the same left edge as their content.
14. **Visual hierarchy.** One clear title per screen, supporting text in `text-fg-muted`, meta in `text-fg-subtle`. Size and weight carry hierarchy, not color.
15. **Contrast of at least 4.5:1 for text.** Use `text-fg`, `text-fg-muted`, `text-fg-subtle` (all pass on `bg-canvas` and `bg-surface`). Never put grey text on a colored fill or `text-gray-400` on white.
16. **Dark mode for free.** Use only the semantic tokens (`bg-surface`, `text-fg`, `border-border` ...). Do not write raw colors like `bg-white`, `text-black`, `bg-gray-100`; they break in dark mode. Check both themes before you finish.

## 4. Token cheat sheet

Semantic Tailwind utilities (they switch with the theme and accent):

| Purpose | Classes |
|---|---|
| Backgrounds | `bg-canvas` (page), `bg-canvas-subtle` (app background behind cards, grouped lists), `bg-surface` (cards), `bg-surface-raised` (menus, dialogs), `bg-muted` (hover, tracks), `bg-muted-strong` (pressed) |
| Text | `text-fg`, `text-fg-muted`, `text-fg-subtle`, `text-accent-text` (links), `text-inverse-fg` |
| Borders | `border-border`, `border-border-strong`, `divide-border` |
| Accent | `bg-accent`, `hover:bg-accent-hover`, `text-accent-fg` (text on accent), `bg-accent-soft` (tint), `ring-ring` |
| Status | `bg-success`, `text-success-text`, `bg-success-soft` and the same for `warning`, `danger`, `info` |
| Inverse | `bg-inverse text-inverse-fg` (tooltips, dark chips) |
| Radius | `rounded-xs` 4, `rounded-sm` 6, `rounded-md` 8, `rounded-lg` 10, `rounded-xl` 14, `rounded-2xl` 18, `rounded-3xl` 24 |
| Shadow | `shadow-xs`, `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl` (soft, layered, darker in dark mode) |
| Fonts | `font-sans` (system, SF Pro), `font-display` (headings), `font-mono`, `tabular-nums` |
| Greys | `gray-0` to `gray-950` (only for things that must not change with the theme) |

Inline styles and SVG fills must use the CSS variables, not `--color-*`:
`var(--atox-accent)`, `var(--atox-chart-2)` to `var(--atox-chart-5)`, `var(--atox-fg-subtle)`, `var(--atox-border)`, `var(--atox-surface)`.

`className` on any kit component wins over the component's own classes of the same kind (`<Input className="bg-muted border-transparent" />` works).

Themes: `<Screen mode="dark">` forces dark, `<Theme mode="dark">` makes one region dark (for example a dark band on a light page). Without `mode` the screen follows the canvas.

## 5. Components

Every component is typed; open `components/*.tsx` if you need the full prop list.

### Layout and text

| Component | Key props | Example |
|---|---|---|
| `Screen` | `mode`, `accent`, `layout` app or page, `background` canvas or subtle, `inset` | `<Screen accent="emerald" background="subtle">` |
| `ScrollArea` | `className` | `<ScrollArea className="px-4">...</ScrollArea>` |
| `Theme` | `mode`, `accent` | `<Theme mode="dark" className="rounded-2xl p-8">` |
| `Container` | `size` sm, md, lg, xl, full | `<Container className="py-20">` |
| `Stack`, `Row`, `Grid` | `gap` (Tailwind step), `align`, `justify`, `cols` | `<Grid cols={4} gap={4}>` |
| `Heading` | `size` display, h1 to h5 | `<Heading size="h1">Billing</Heading>` |
| `Text` | `size`, `tone` default, muted, subtle, accent, success, danger, `weight` regular or semibold, `numeric` | `<Text tone="muted">Updated 2m ago</Text>` |
| `Icon` | `icon`, `size` | `<Icon icon={Lock} size={16} className="text-fg-subtle" />` |

### Controls

| Component | Key props | Example |
|---|---|---|
| `Button` | `variant` primary, secondary, outline, ghost, destructive, link; `size` sm 28, md 36, lg 44, xl 52; `icon`, `iconRight`, `loading`, `fullWidth`, `disabled` | `<Button icon={Plus}>New invoice</Button>` |
| `IconButton` | `icon`, `label` (required), `variant`, `size`, `round` | `<IconButton icon={Bell} label="Notifications" />` |
| `Input` | `size` sm, md, lg; `icon`, `suffix`, `invalid` + input props | `<Input icon={Mail} placeholder="you@company.com" />` |
| `Textarea` | `rows`, `invalid` | `<Textarea rows={3} placeholder="Add a note" />` |
| `Select` | `options` (strings or `{value,label}`), `size`, `placeholder` | `<Select options={['Admin', 'Member']} defaultValue="Member" />` |
| `Field` | `label`, `labelAction`, `help`, `error`, `required`, children or `(id) => control` | `<Field label="Email" error="Enter a valid email">{(id) => <Input id={id} invalid />}</Field>` |
| `Checkbox` | `label`, `description`, `indeterminate`, `defaultChecked` | `<Checkbox label="Remember me" defaultChecked />` |
| `Radio`, `RadioGroup` | `options`, `defaultValue`, `variant` plain or card | `<RadioGroup variant="card" options={plans} defaultValue="pro" />` |
| `Switch` | `defaultChecked`, `size` sm (desktop) or md (phone), `label`, `description` | `<Switch size="md" defaultChecked />` |
| `Slider` | `defaultValue`, `min`, `max`, `step`, `label`, `showValue`, `format` | `<Slider label="Volume" showValue defaultValue={60} />` |
| `SegmentedControl` | `items` (strings or `{value,label,icon}`), `defaultValue`, `size`, `fullWidth` | `<SegmentedControl items={['7d', '30d', '12m']} defaultValue="30d" size="sm" />` |
| `Tabs` | `items` (strings or `{value,label,count,icon}`), `variant` underline or pills | `<Tabs items={[{ value: 'open', label: 'Open', count: 12 }, 'Closed']} />` |
| `Kbd` | `keys` | `<Kbd keys={['⌘', 'K']} />` |

### Display and feedback

| Component | Key props | Example |
|---|---|---|
| `Badge` | `tone` neutral, accent, success, warning, danger, info; `variant` soft, solid, outline; `dot`, `icon`, `size` | `<Badge tone="success" dot>Paid</Badge>` |
| `Tag` | `color` (tone dot), `icon`, `selected`, `onRemove` | `<Tag color="accent" onRemove={() => {}}>Design</Tag>` |
| `Avatar` | `name` (initials and color), `src`, `size` xs to xl, `status`, `square` | `<Avatar name="Maya Chen" status="online" />` |
| `AvatarGroup` | `names`, `max`, `size` | `<AvatarGroup names={team} max={4} />` |
| `Tooltip` | `content`, `shortcut`, `side`, children | `<Tooltip content="Duplicate" shortcut={['⌘', 'D']}><IconButton ... /></Tooltip>` |
| `Divider` | `orientation`, `label` | `<Divider label="or" />` |
| `Spinner` | `size` | `<Spinner size="md" />` |
| `Skeleton`, `SkeletonText` | `className` sets the shape, `lines` | `<Skeleton className="size-10 rounded-full" />` |
| `Progress` | `value`, `max`, `tone`, `label`, `showValue`, `size` | `<Progress label="Storage" value={72} showValue />` |
| `Card` | `variant` default, elevated, muted, ghost; `padding` none, sm, md, lg; `interactive` | `<Card padding="none">` |
| `CardHeader`, `CardFooter` | `title`, `description`, `action` | `<CardHeader title="Revenue" action={<Button variant="ghost" size="sm">View all</Button>} />` |
| `Stat` | `label`, `value`, `delta`, `invertDelta`, `hint`, `icon`, `trend`, `bare` | `<Stat label="MRR" value="$84,210" delta={12.4} hint="vs Oct" trend={[52, 58, 61, 67]} />` |
| `EmptyState` | `icon`, `title`, `description`, `actions`, `bordered` | `<EmptyState icon={Inbox} title="No messages yet" actions={<Button>Connect inbox</Button>} />` |
| `Alert` | `tone`, `title`, children, `action`, `onDismiss`, `layout` inline or banner | `<Alert tone="warning" title="Trial ends in 3 days" />` |
| `Toast` | `tone`, `title`, `description`, `action`, `placement` inline, top, bottom, bottom-right | `<Toast title="Changes saved" placement="bottom-right" />` |
| `Dialog` | `title`, `description`, `icon`, `iconTone`, `footer`, `onClose`, `size`, `overlay` | `<Dialog overlay title="Delete project?" footer={...} />` |
| `Sheet` | `title`, `description`, `footer`, `overlay` (phone bottom sheet) | `<Sheet overlay title="Filters">...</Sheet>` |
| `Popover` | `width`, children | `<Popover width="w-72" className="p-4">...</Popover>` |
| `Menu` | `items` (`{label, icon, shortcut, active, checked, danger, disabled}`, `{separator: true}`, `{heading}`) | `<Menu items={[{ label: 'Edit', icon: Pencil }, { separator: true }, { label: 'Delete', icon: Trash2, danger: true }]} />` |
| `Overlay` | `align` center, bottom, right | `<Overlay align="right">...</Overlay>` |

Dialogs, sheets, menus and tooltips are drawn open, in place. To show one over the screen, pass `overlay` (the dim layer covers the nearest `relative` parent; `Screen` is one).

### Navigation and data

| Component | Key props | Example |
|---|---|---|
| `Breadcrumbs` | `items` (strings or `{label, icon}`) | `<Breadcrumbs items={['Acme', 'Projects', 'Atlas']} />` |
| `Pagination` | `pageCount`, `defaultPage`, `summary` | `<Pagination pageCount={16} defaultPage={6} summary="Showing 101 to 120 of 312" />` |
| `Table` | `columns` (`{key, header, render, align, width}`), `rows`, `rowKey`, `selected`, `selectable`, `density`, `empty` | see the dashboard example |
| `List` | `header`, `footer`, `variant` inset or plain | `<List header="Account">...</List>` |
| `ListItem` | `title`, `description`, `icon`, `iconColor` (accent, gray, blue, green, orange, red, purple, pink, plain), `leading`, `value`, `trailing`, `chevron`, `destructive` | `<ListItem icon={Bell} iconColor="red" title="Notifications" chevron />` |

### Phone chrome

| Component | Key props | Example |
|---|---|---|
| `StatusBar` | `time`, `tone` auto, light, dark; `battery`, `island` | `<StatusBar />` |
| `NavBar` | `title`, `large`, `subtitle`, `back` (label or true), `actions`, `bordered`, children (search under title) | `<NavBar back="Wallet" title="Groceries" bordered />` |
| `TabBar` | `items` (`{value, label, icon, badge}`, 3 to 5), `defaultValue`, `homeIndicator` | `<TabBar items={tabs} defaultValue="home" />` |
| `HomeIndicator` | `tone` | `<HomeIndicator />` (only when there is no `TabBar`) |
| `Fab` | `icon`, `label`, `extended`, `floating` | `<Fab icon={Plus} label="Add expense" floating />` |
| `ActionSheet` | `title`, `message`, `actions` (`{label, icon, destructive}`), `cancelLabel`, `overlay` | `<ActionSheet overlay actions={[{ label: 'Delete photo', destructive: true }]} />` |

### Desktop and web app chrome

| Component | Key props | Example |
|---|---|---|
| `Brand` | `name`, `icon`, `size`, `markOnly` (logo without images) | `<Brand name="Tally" icon={Wallet} />` |
| `Sidebar` | `header`, `footer`, `collapsed` | `<Sidebar header={<Brand ... />}>` |
| `SidebarSection` | `title`, `action` | `<SidebarSection title="Teams">` |
| `SidebarItem` | `icon`, `label`, `active`, `count`, `shortcut`, `dot` (CSS color) | `<SidebarItem icon={Inbox} label="Inbox" count={4} active />` |
| `Topbar` | `leading`, `center`, `actions` | `<Topbar leading={<Breadcrumbs ... />} actions={<Avatar name="Maya Chen" size="sm" />} />` |
| `SearchField` | `placeholder`, `shortcut` | `<SearchField placeholder="Search issues" />` |
| `CommandBar` | `query`, `groups` (`{heading, items: {label, icon, hint, shortcut}}`), `activeIndex` | `<CommandBar query="inv" groups={groups} />` |
| `PageHeader` | `title`, `description`, `eyebrow`, `actions`, `tabs` | `<PageHeader title="Overview" actions={<Button>New</Button>} />` |
| `Section` | `title`, `description`, `actions`, `layout` stacked or side | `<Section layout="side" title="Profile">...</Section>` |

### Website

| Component | Key props | Example |
|---|---|---|
| `SiteNav` | `brand`, `links`, `actions`, `bordered` | `<SiteNav brand={<Brand ... />} links={['Product', 'Pricing']} actions={<Button>Sign up</Button>} />` |
| `Hero` | `eyebrow`, `title`, `description`, `actions`, `note`, `align` center or left, children (visual) | see the landing example |
| `FeatureGrid` | `features` (`{icon, title, description}`), `columns` 2 to 4, `variant` plain or card | `<FeatureGrid features={features} />` |
| `PricingCard` | `name`, `price`, `period`, `description`, `features`, `cta`, `featured`, `badge` | `<PricingCard featured name="Pro" price="$24" period="/month" ... />` |
| `Testimonial` | `quote`, `name`, `role`, `rating` | `<Testimonial quote="..." name="Priya Raman" role="VP Engineering, Linework" />` |
| `FaqItem` | `question`, `answer`, `open` | `<FaqItem open question="Can I cancel?" answer="Yes, anytime." />` |
| `CtaBand` | `title`, `description`, `actions`, `tone` inverse, accent, muted | `<CtaBand title="Start today" actions={<Button>Start</Button>} />` |
| `Footer` | `brand`, `description`, `columns` (`{title, links}`), `bottom` | see the landing example |

`SiteNav` is the website header; `NavBar` is the phone header. Do not mix them up.

### Charts (no library, fluid width, theme colors)

| Component | Key props | Example |
|---|---|---|
| `LineChart` | `data` or `series` (`{name, data, color, dashed}`), `labels`, `height`, `area`, `format`, `highlight` | `<LineChart labels={months} series={[{ name: '2026', data: [52, 58, 61] }]} />` |
| `AreaChart` | same as `LineChart` with a filled area | `<AreaChart data={[12, 18, 15, 22]} labels={['Q1', 'Q2', 'Q3', 'Q4']} />` |
| `BarChart` | `data` (numbers or `{label, value}`), `labels`, `height`, `tone`, `highlight`, `format` | `<BarChart data={signups} labels={weeks} highlight={11} />` |
| `Donut` | `data` (`{label, value, color}`), `size`, `thickness`, `centerValue`, `centerLabel`, `legend` right, bottom, none | `<Donut data={plans} centerValue="1,328" centerLabel="subscribers" />` |
| `Sparkline` | `data`, `tone`, `area`, `className` (size) | `<Sparkline data={trend} className="h-8 w-24" />` |
| `Legend` | `items` (`{label, color, value}`) | `<Legend items={[{ label: 'Paid', color: 'var(--atox-accent)' }]} />` |

Chart rules: series 1 is always the accent, then `chart-2` to `chart-5` in order; at most 5 series (fold the rest into "Other"). A comparison series (last year, forecast) is `dashed` and `color: 'var(--atox-fg-subtle)'`. One y axis only. Values and labels stay in text colors.

## 6. Example screens

Three complete screens written with the kit (mobile login, website landing, desktop dashboard) are in `examples.md` next to this file. Open it only when you want a full example to copy; you do not need it for small changes.

## 7. Pre-flight checklist

Run `atox canvas screen preview`, look at the screenshot, and check every line. Fix and preview again until all pass.

- [ ] Nothing is clipped, overlapping or cut off at the frame edge; long names truncate cleanly.
- [ ] Exactly one primary button in view; the most important thing is the biggest or boldest thing.
- [ ] Only regular and semibold weights; sizes come from the type scale; no ad hoc `text-[19px]`.
- [ ] Spacing is on the 8px rhythm and consistent between similar blocks; left edges align.
- [ ] One accent color; status colors only on statuses.
- [ ] All text is readable: no grey on color, no light grey body text; contrast at least 4.5:1.
- [ ] Content is real and specific: names, amounts, dates, product copy. No lorem ipsum or "Item 1".
- [ ] Phone: `StatusBar` on top, touch targets 44px or more, `TabBar` or `HomeIndicator` at the bottom, nothing under the status bar.
- [ ] Icons are lucide, one style, 16px desktop or 20px phone, never mixed with emoji.
- [ ] Empty, loading or error states exist where the screen could have them (at least as a separate screen).
- [ ] Borders are subtle; heavy shadows only on floating elements.
- [ ] Dark mode: preview with the dark theme; no raw `bg-white`, `text-black` or `gray-*` breaks it.
- [ ] Numbers line up (`tabular-nums`, right aligned in tables).
