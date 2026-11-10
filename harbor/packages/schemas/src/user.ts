import { z } from 'zod'
import type { DirectoryRecord } from './directory.ts'

export const RoleSchema = z.enum(['Trader', 'Portfolio Manager', 'Operations', 'Treasury', 'Admin'])
export type Role = z.infer<typeof RoleSchema>

export const UserInfoSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  role: RoleSchema,
  entitlements: z.object({
    /** Entitlement keys matched against a record's `requiredEntitlement`. */
    apps: z.array(z.string()),
    /** Intent names the user may raise. `*` means any. */
    intents: z.array(z.string()),
  }),
})
/** What apps see via `getUserInfo()`. Deliberately has no credentials. */
export type UserInfo = z.infer<typeof UserInfoSchema>

export function canLaunch(user: UserInfo, record: DirectoryRecord): boolean {
  return user.entitlements.apps.includes(record.requiredEntitlement)
}

export function canRaise(user: UserInfo, intent: string): boolean {
  return user.entitlements.intents.includes('*') || user.entitlements.intents.includes(intent)
}
