/**
 * Пример: лендинг продукта. Устройство: browser, 1280 x 800 (страница прокручивается).
 */
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
