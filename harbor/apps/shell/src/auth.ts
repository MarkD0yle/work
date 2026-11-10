import type { UserInfo } from '@harbor/schemas'

/** Auth sits behind this interface so a real identity provider can replace the mock. */
export interface AuthProvider {
  listUsers(): UserInfo[]
  current(): UserInfo | null
  signIn(userId: string): UserInfo
  signOut(): void
}

const NEWS = ['app.research', 'app.partner-news']
const DEV = 'dev.tools'
/** The order blotter and the tiles that go with it. */
const DESK = ['app.blotter', 'app.tiles']

/** Five seeded mock users, one per role. No credentials exist anywhere. */
export const MOCK_USERS: UserInfo[] = [
  {
    id: 'u-trader',
    displayName: 'Tess Lindqvist',
    role: 'Trader',
    entitlements: { apps: [DEV, ...DESK, 'app.pretrade', 'app.fx-exec', 'app.post-trade', 'app.tca', ...NEWS], intents: ['*'] },
  },
  {
    id: 'u-pm',
    displayName: 'Priya Malhotra',
    role: 'Portfolio Manager',
    entitlements: {
      apps: [DEV, ...DESK, 'app.pretrade', 'app.tca', 'app.cash', ...NEWS],
      intents: ['harbor.AnalyseOrder', 'ViewAnalysis', 'ViewNews', 'harbor.PlaceCash'],
    },
  },
  {
    id: 'u-ops',
    displayName: 'Omar Haddad',
    role: 'Operations',
    entitlements: {
      apps: [DEV, 'app.tiles', 'app.post-trade', 'app.tca', 'app.payments', ...NEWS],
      intents: ['harbor.ViewSettlement', 'ViewAnalysis', 'ViewNews', 'harbor.SendPayment', 'harbor.dev.ForceMismatch'],
    },
  },
  {
    id: 'u-treasury',
    displayName: 'Tomás Reyes',
    role: 'Treasury',
    entitlements: { apps: [DEV, 'app.tiles', 'app.cash', 'app.payments', 'app.research'], intents: ['harbor.PlaceCash', 'harbor.SendPayment', 'ViewNews'] },
  },
  {
    id: 'u-admin',
    displayName: 'Ada Novak',
    role: 'Admin',
    entitlements: {
      apps: [DEV, ...DESK, 'app.pretrade', 'app.fx-exec', 'app.post-trade', 'app.tca', 'app.cash', 'app.payments', ...NEWS],
      intents: ['*'],
    },
  },
]

const KEY = 'harbor.session.userId'

export class MockAuth implements AuthProvider {
  listUsers(): UserInfo[] {
    return MOCK_USERS
  }
  current(): UserInfo | null {
    const id = localStorage.getItem(KEY)
    return MOCK_USERS.find((u) => u.id === id) ?? null
  }
  signIn(userId: string): UserInfo {
    const user = MOCK_USERS.find((u) => u.id === userId)
    if (!user) throw new Error(`Unknown user ${userId}`)
    localStorage.setItem(KEY, user.id)
    return user
  }
  signOut(): void {
    localStorage.removeItem(KEY)
  }
}

export const auth: AuthProvider = new MockAuth()
