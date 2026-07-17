import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk'
import { getDb } from './db'

const expo = new Expo()

/**
 * Clean up tokens that Expo reports as DeviceNotRegistered.
 */
async function cleanupDeadTokens(deadTokens: string[]) {
  if (deadTokens.length === 0) return
  const db = getDb()
  for (const token of deadTokens) {
    await db`UPDATE users SET push_token = NULL WHERE push_token = ${token}`
  }
}

/**
 * Send push notifications to one or more Expo push tokens.
 * Handles ticket results and cleans up dead tokens.
 */
export async function sendPush(tokens: string[], title: string, body: string, data?: Record<string, unknown>) {
  const valid = tokens.filter((t) => Expo.isExpoPushToken(t))
  if (valid.length === 0) return

  const messages: ExpoPushMessage[] = valid.map((to) => ({
    to,
    sound: 'default',
    title,
    body,
    data: data ?? {},
  }))

  const chunks = expo.chunkPushNotifications(messages)
  const deadTokens: string[] = []

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk)
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i]
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          deadTokens.push(chunk[i].to as string)
        }
      }
    } catch {
      // transient network error — skip this chunk
    }
  }

  // Clean up dead tokens in background
  if (deadTokens.length > 0) {
    cleanupDeadTokens(deadTokens).catch(() => {})
  }
}

/**
 * Send a push notification to a single user (by user_id).
 * Looks up their push_token from the users table.
 */
export async function pushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
) {
  const db = getDb()
  const rows = await db<{ push_token: string | null }[]>`
    SELECT push_token FROM users WHERE id = ${userId} AND push_token IS NOT NULL LIMIT 1
  `
  const token = rows[0]?.push_token
  if (!token) return
  await sendPush([token], title, body, data)
}

/**
 * Send a push notification to all active users who hold a given permission.
 */
export async function pushToUsersWithPermission(
  permissionKey: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
) {
  const db = getDb()
  const rows = await db<{ push_token: string | null }[]>`
    SELECT DISTINCT u.push_token
    FROM users u
    WHERE u.is_active = true
      AND u.account_status = 'active'
      AND u.push_token IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM role_permissions rp
          INNER JOIN permissions p ON p.permission_id = rp.permission_id
          WHERE rp.role_id = u.role_id AND p.permission_key = ${permissionKey}
        )
        OR EXISTS (
          SELECT 1 FROM user_permissions up
          INNER JOIN permissions p ON p.permission_id = up.permission_id
          WHERE up.user_id = u.id AND up.grant_type = 'grant' AND p.permission_key = ${permissionKey}
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM user_permissions up
        INNER JOIN permissions p ON p.permission_id = up.permission_id
        WHERE up.user_id = u.id AND up.grant_type = 'deny' AND p.permission_key = ${permissionKey}
      )
  `
  const tokens = rows.map((r) => r.push_token).filter(Boolean) as string[]
  if (tokens.length === 0) return
  await sendPush(tokens, title, body, data)
}

/**
 * Send a push notification to all active users.
 * Uses DISTINCT to avoid duplicate tokens.
 */
export async function pushToAllUsers(
  title: string,
  body: string,
  data?: Record<string, unknown>,
) {
  const db = getDb()
  const rows = await db<{ push_token: string | null }[]>`
    SELECT DISTINCT push_token FROM users
    WHERE is_active = true AND account_status = 'active' AND push_token IS NOT NULL
  `
  const tokens = rows.map((r) => r.push_token).filter(Boolean) as string[]
  if (tokens.length === 0) return
  await sendPush(tokens, title, body, data)
}
