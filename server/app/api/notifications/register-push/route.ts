import { Expo } from 'expo-server-sdk'
import { requireUser } from '@/lib/auth'
import { jsonOk, jsonError } from '@/lib/api-response'
import { getDb } from '@/lib/db'
import { handleRoute } from '@/lib/route-handler'

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    const body = await request.json().catch(() => ({}))
    const pushToken = String(body.push_token ?? '').trim()

    if (!pushToken) return jsonOk({ saved: false })

    // Validate Expo push token format
    if (!Expo.isExpoPushToken(pushToken)) {
      return jsonError('Invalid push token format', 422)
    }

    // Reasonable length limit
    if (pushToken.length > 200) {
      return jsonError('Push token too long', 422)
    }

    const db = getDb()
    await db`UPDATE users SET push_token = ${pushToken} WHERE id = ${user.id}`
    return jsonOk({ saved: true })
  })
}
