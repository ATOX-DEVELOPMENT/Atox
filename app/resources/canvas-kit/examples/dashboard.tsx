/**
 * Пример: дашборд десктопного приложения. Устройство: desktop, 1100 x 700.
 */
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
