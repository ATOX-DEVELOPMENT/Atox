/**
 * Пример: экран входа мобильного приложения. Устройство: phone, 390 x 844.
 */
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
