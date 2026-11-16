# Atox canvas kit: example screens

Complete screens built with `@atox/ui`. Copy one, then change the content. The rules and the component reference are in `kit.md`.

## Mobile login (`examples/login.tsx`)

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

## Website landing (`examples/landing.tsx`)

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

## Desktop dashboard (`examples/dashboard.tsx`)

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
