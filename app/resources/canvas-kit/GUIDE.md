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

Copy these, then change the content. They live in `examples/` and compile against the kit.

### Mobile login (`examples/login.tsx`)

Device: iPhone, 390 x 844. Accent emerald. Shows: status bar, brand mark, title and lead, labeled fields with icons, one primary action, a secondary path, footer link, home indicator.

```tsx
import { ArrowRight, Eye, KeyRound, Leaf, Lock, Mail } from 'lucide-react'
import {
  Brand,
  Button,
  Divider,
  Field,
  HomeIndicator,
  IconButton,
  Input,
  Screen,
  ScrollArea,
  StatusBar,
  Text
} from '@atox/ui'

export default function Login() {
  return (
    <Screen accent="emerald">
      <StatusBar />
      <ScrollArea className="flex flex-col px-6 pt-10">
        <Brand name="Fern" icon={Leaf} size="lg" markOnly />
        <div className="mt-8 grid gap-2">
          <h1 className="text-3xl font-semibold text-fg">Welcome back</h1>
          <Text size="base" tone="muted">
            Sign in to keep your budgets and shared accounts in sync.
          </Text>
        </div>

        <form className="mt-10 grid gap-5">
          <Field label="Email">
            {(id) => (
              <Input id={id} size="lg" icon={Mail} type="email" defaultValue="maya.chen@hey.com" autoComplete="email" />
            )}
          </Field>
          <Field label="Password" labelAction={<a className="font-semibold text-accent-text">Forgot?</a>}>
            {(id) => (
              <Input
                id={id}
                size="lg"
                icon={Lock}
                type="password"
                defaultValue="correct-horse"
                suffix={<IconButton icon={Eye} label="Show password" size="sm" className="-mr-1.5" />}
              />
            )}
          </Field>
          <Button size="xl" fullWidth iconRight={ArrowRight} className="mt-3">
            Sign in
          </Button>
        </form>

        <Divider label="or" className="my-6" />
        <Button variant="secondary" size="xl" fullWidth icon={KeyRound}>
          Sign in with a passkey
        </Button>

        <p className="mt-auto pt-10 pb-4 text-center text-sm text-fg-muted">
          New to Fern? <a className="font-semibold text-accent-text">Create an account</a>
        </p>
      </ScrollArea>
      <HomeIndicator />
    </Screen>
  )
}
```

### Website landing (`examples/landing.tsx`)

Device: Website, 1280 x 800, `layout="page"` so it scrolls. Shows: site nav, hero with a product mockup built from kit parts, features, testimonials, CTA band, footer.

```tsx
import {
  ArrowRight,
  BellRing,
  Bot,
  ChartNoAxesColumn,
  Radar,
  ShieldCheck,
  Siren,
  Workflow
} from 'lucide-react'
import {
  Badge,
  Brand,
  Button,
  Container,
  CtaBand,
  FeatureGrid,
  Footer,
  Hero,
  Screen,
  SiteNav,
  Stat,
  AreaChart,
  Testimonial
} from '@atox/ui'

const features = [
  {
    icon: Radar,
    title: 'Detect in seconds',
    description: 'Anomaly detection on every metric you already ship, with no thresholds to tune.'
  },
  {
    icon: BellRing,
    title: 'Page the right person',
    description: 'On-call schedules, escalation rules and quiet hours that follow your team across time zones.'
  },
  {
    icon: Bot,
    title: 'AI incident summaries',
    description: 'A clear timeline of what broke, who did what and what changed, written as it happens.'
  },
  {
    icon: Workflow,
    title: 'Runbooks that run',
    description: 'Turn the fix you typed at 3 a.m. into a one-click action for the next responder.'
  },
  {
    icon: ChartNoAxesColumn,
    title: 'Reliability reports',
    description: 'MTTR, error budgets and SLO burn per service, ready for the Monday review.'
  },
  {
    icon: ShieldCheck,
    title: 'SOC 2 and SSO',
    description: 'SAML, SCIM provisioning and audit logs on every plan, not just the enterprise one.'
  }
]

const latency = [182, 176, 190, 185, 214, 268, 241, 198, 176, 171, 169, 174]
const hours = ['00', '02', '04', '06', '08', '10', '12', '14', '16', '18', '20', '22']

export default function Landing() {
  return (
    <Screen layout="page" accent="indigo">
      <SiteNav
        brand={<Brand name="Beacon" icon={Siren} />}
        links={['Product', 'Customers', 'Pricing', 'Docs', 'Changelog']}
        actions={
          <>
            <Button variant="ghost">Sign in</Button>
            <Button>Start free trial</Button>
          </>
        }
      />

      <Hero
        eyebrow={
          <Badge tone="accent" size="md">
            New: AI incident summaries
          </Badge>
        }
        title="Resolve incidents before your customers notice"
        description="Beacon watches your services, pages the right engineer and writes the postmortem while you fix the problem."
        actions={
          <>
            <Button size="lg" iconRight={ArrowRight}>
              Start free trial
            </Button>
            <Button size="lg" variant="secondary">
              Book a demo
            </Button>
          </>
        }
        note="Free for 14 days. No credit card required."
      >
        <div className="mx-auto w-full max-w-5xl rounded-2xl border border-border bg-canvas-subtle p-2 shadow-xl">
          <div className="grid gap-4 rounded-xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <div className="grid gap-0.5">
                <span className="text-sm font-semibold text-fg">checkout-api</span>
                <span className="text-xs text-fg-muted">p95 latency, last 24 hours</span>
              </div>
              <Badge tone="success" dot>
                Resolved in 6 min
              </Badge>
            </div>
            <div className="grid grid-cols-[1fr_220px] gap-6">
              <AreaChart data={latency} labels={hours} height={180} format={(value) => `${value}ms`} highlight={5} />
              <div className="grid content-start gap-3">
                <Stat label="Incidents this week" value="3" delta={-40} invertDelta hint="vs last week" />
                <Stat label="Mean time to resolve" value="11m" delta={-22} invertDelta />
              </div>
            </div>
          </div>
        </div>
      </Hero>

      <section className="border-t border-border py-20">
        <Container>
          <div className="mb-12 grid max-w-2xl gap-3">
            <h2 className="text-3xl font-semibold text-fg">Everything on-call needs, nothing it does not</h2>
            <p className="text-lg text-fg-muted">One tool from the first alert to the final postmortem.</p>
          </div>
          <FeatureGrid features={features} />
        </Container>
      </section>

      <section className="bg-canvas-subtle py-20">
        <Container className="grid gap-4 md:grid-cols-3">
          <Testimonial
            quote="We cut our mean time to resolve from 48 minutes to 11. The summaries alone save our leads an hour per incident."
            name="Priya Raman"
            role="VP Engineering, Linework"
          />
          <Testimonial
            quote="Beacon is the first paging tool our engineers do not complain about. Quiet hours actually work."
            name="Tomás Ferreira"
            role="SRE Lead, Parcelly"
          />
          <Testimonial
            quote="Runbooks turned tribal knowledge into buttons. New hires join the rotation in their second week."
            name="Hannah Okafor"
            role="Platform Manager, Mintgrid"
          />
        </Container>
      </section>

      <Container className="py-20">
        <CtaBand
          title="Your next incident can be a short one"
          description="Connect Datadog, Grafana or Sentry in five minutes."
          actions={
            <>
              <Button size="lg" variant="secondary">
                Talk to sales
              </Button>
              <Button size="lg">Start free trial</Button>
            </>
          }
        />
      </Container>

      <Footer
        brand={<Brand name="Beacon" icon={Siren} size="sm" />}
        description="Incident management for engineering teams that ship every day."
        columns={[
          { title: 'Product', links: ['Alerting', 'On-call', 'Status pages', 'Integrations'] },
          { title: 'Company', links: ['About', 'Customers', 'Careers', 'Blog'] },
          { title: 'Resources', links: ['Docs', 'API reference', 'Changelog', 'Status'] },
          { title: 'Legal', links: ['Privacy', 'Terms', 'Security', 'DPA'] }
        ]}
        bottom={
          <>
            <span>© 2026 Beacon Labs, Inc.</span>
            <span>All systems operational</span>
          </>
        }
      />
    </Screen>
  )
}
```

### Desktop dashboard (`examples/dashboard.tsx`)

Device: Desktop app, 1100 x 700. Shows: sidebar with groups, top bar with breadcrumbs and search, page header with period switch, four stats, area chart against last year, donut, payments table with a selected row.

```tsx
import {
  Bell,
  ChartLine,
  CreditCard,
  Download,
  FileText,
  Inbox,
  LayoutGrid,
  Plus,
  Settings,
  Users,
  Wallet
} from 'lucide-react'
import {
  AreaChart,
  Avatar,
  Badge,
  Brand,
  Breadcrumbs,
  Button,
  Card,
  CardHeader,
  Donut,
  IconButton,
  PageHeader,
  Screen,
  ScrollArea,
  SearchField,
  SegmentedControl,
  Sidebar,
  SidebarItem,
  SidebarSection,
  Stat,
  Table,
  Topbar,
  type TableColumn
} from '@atox/ui'

interface Payment {
  id: string
  customer: string
  email: string
  plan: 'Starter' | 'Growth' | 'Scale'
  status: 'Paid' | 'Pending' | 'Failed'
  amount: string
  date: string
}

const payments: Payment[] = [
  { id: 'in_8241', customer: 'Lena Fischer', email: 'lena@northwind.io', plan: 'Scale', status: 'Paid', amount: '$1,240.00', date: 'Nov 16, 09:12' },
  { id: 'in_8240', customer: 'Marcus Webb', email: 'marcus@fieldnote.app', plan: 'Growth', status: 'Pending', amount: '$480.00', date: 'Nov 16, 08:47' },
  { id: 'in_8239', customer: 'Aiko Tanaka', email: 'aiko@kumo.dev', plan: 'Growth', status: 'Paid', amount: '$480.00', date: 'Nov 15, 22:03' },
  { id: 'in_8238', customer: 'Diego Morales', email: 'diego@tinta.mx', plan: 'Starter', status: 'Failed', amount: '$89.00', date: 'Nov 15, 18:30' },
  { id: 'in_8237', customer: 'Sofia Lindqvist', email: 'sofia@harbor.se', plan: 'Scale', status: 'Paid', amount: '$1,240.00', date: 'Nov 15, 14:55' }
]

const statusTone = { Paid: 'success', Pending: 'warning', Failed: 'danger' } as const

const columns: TableColumn<Payment>[] = [
  {
    key: 'customer',
    header: 'Customer',
    render: (row) => (
      <div className="flex items-center gap-3">
        <Avatar name={row.customer} size="md" />
        <div className="grid">
          <span className="font-semibold">{row.customer}</span>
          <span className="text-xs text-fg-muted">{row.email}</span>
        </div>
      </div>
    )
  },
  { key: 'plan', header: 'Plan', render: (row) => <span className="text-fg-muted">{row.plan}</span> },
  {
    key: 'status',
    header: 'Status',
    render: (row) => (
      <Badge tone={statusTone[row.status]} dot>
        {row.status}
      </Badge>
    )
  },
  { key: 'date', header: 'Date', render: (row) => <span className="text-fg-muted">{row.date}</span> },
  { key: 'amount', header: 'Amount', align: 'right', render: (row) => <span className="font-semibold">{row.amount}</span> }
]

const months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']

export default function Dashboard() {
  return (
    <Screen className="flex-row">
      <Sidebar
        header={<Brand name="Tally" icon={Wallet} size="sm" />}
        footer={
          <div className="flex items-center gap-2.5 px-1">
            <Avatar name="Noah Patel" size="md" status="online" />
            <div className="grid min-w-0 flex-1">
              <span className="truncate text-sm font-semibold text-fg">Noah Patel</span>
              <span className="truncate text-xs text-fg-muted">Finance lead</span>
            </div>
            <IconButton icon={Settings} label="Settings" size="sm" />
          </div>
        }
      >
        <SidebarSection>
          <SidebarItem icon={LayoutGrid} label="Overview" active />
          <SidebarItem icon={Inbox} label="Inbox" count={4} />
          <SidebarItem icon={ChartLine} label="Revenue" />
          <SidebarItem icon={Users} label="Customers" />
          <SidebarItem icon={CreditCard} label="Payments" />
          <SidebarItem icon={FileText} label="Invoices" />
        </SidebarSection>
        <SidebarSection title="Segments">
          <SidebarItem dot="var(--atox-accent)" label="Enterprise" count={38} />
          <SidebarItem dot="var(--atox-chart-2)" label="Self-serve" count="1,204" />
          <SidebarItem dot="var(--atox-chart-3)" label="Trials" count={86} />
        </SidebarSection>
      </Sidebar>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          leading={<Breadcrumbs items={['Acme Billing', 'Overview']} />}
          actions={
            <>
              <SearchField placeholder="Search customers" className="w-56" />
              <IconButton icon={Bell} label="Notifications" />
            </>
          }
        />
        <ScrollArea className="bg-canvas-subtle">
          <div className="grid gap-6 p-6">
            <PageHeader
              title="Overview"
              description="Revenue and billing health for November 2026."
              actions={
                <>
                  <SegmentedControl items={['7d', '30d', '6m', '12m']} defaultValue="6m" size="sm" />
                  <Button variant="secondary" size="sm" icon={Download}>
                    Export
                  </Button>
                  <Button size="sm" icon={Plus}>
                    New invoice
                  </Button>
                </>
              }
            />

            <div className="grid grid-cols-4 gap-4">
              <Stat label="Monthly revenue" value="$84,210" delta={12.4} hint="vs Oct" />
              <Stat label="Active subscribers" value="1,328" delta={4.1} hint="vs Oct" />
              <Stat label="Churn rate" value="1.9%" delta={0.3} invertDelta hint="vs Oct" />
              <Stat label="Avg. revenue per user" value="$63.40" delta={-2.2} hint="vs Oct" />
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-4">
              <Card>
                <CardHeader title="Revenue" description="Recurring revenue, this year against last year" />
                <AreaChart
                  className="mt-6"
                  labels={months}
                  height={180}
                  format={(value) => `$${value}k`}
                  series={[
                    { name: '2026', data: [52, 58, 61, 67, 76, 84] },
                    { name: '2025', data: [41, 44, 46, 49, 53, 57], dashed: true, color: 'var(--atox-fg-subtle)' }
                  ]}
                />
              </Card>
              <Card>
                <CardHeader title="Plan mix" description="Share of subscribers" />
                <Donut
                  className="mt-6"
                  size={148}
                  legend="bottom"
                  centerValue="1,328"
                  centerLabel="subscribers"
                  data={[
                    { label: 'Growth', value: 742 },
                    { label: 'Starter', value: 401 },
                    { label: 'Scale', value: 185 }
                  ]}
                />
              </Card>
            </div>

            <Card padding="none">
              <CardHeader
                title="Recent payments"
                description="Last 24 hours"
                action={<Button variant="ghost" size="sm">View all</Button>}
                className="p-5 pb-3"
              />
              <Table columns={columns} rows={payments} rowKey={(row) => row.id} selected={['in_8240']} />
            </Card>
          </div>
        </ScrollArea>
      </div>
    </Screen>
  )
}
```

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
