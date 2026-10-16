/**
 * Telegram impersonation — GramJS (MTProto) helpers.
 *
 * Implements the QR-login-token transfer WITHOUT a QR code:
 *   1. A fresh, unauthenticated GramJS session is created (preAuthSession)
 *      and persisted in the ImpersonationSession row.
 *   2. On demand, auth.exportLoginToken is invoked on that session and the
 *      short-lived token is handed to the user's AzadGram app.
 *   3. The app calls auth.acceptLoginToken on the user's own account —
 *      exactly like confirming a QR login — which authorizes OUR session.
 *   4. The next exportLoginToken call returns auth.loginTokenSuccess and the
 *      now-authorized StringSession is stored (status=ACTIVE, 2h window).
 *
 * All account-explorer API (dialogs/history/send) runs through the stored
 * session and self-revokes after expiry.
 */
import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'
import { Api } from 'telegram'
import bigInt from 'big-integer'

export const TG_API_ID = Number(process.env.TELEGRAM_API_ID ?? 39703773)
export const TG_API_HASH = process.env.TELEGRAM_API_HASH ?? 'eb00e0cce4fc4d8d419be0e73cfd187d'

/** Session lifetime after activation (2 hours). */
export const IMPERSONATION_TTL_MS = 2 * 60 * 60 * 1000
/** How long a PENDING request waits for the app to accept (15 minutes). */
export const IMPERSONATION_PENDING_TTL_MS = 15 * 60 * 1000

function clientOptions() {
  return {
    connectionRetries: 3,
    requestRetries: 2,
    timeout: 15,
    useWSS: false
  } as const
}

/** Create a brand-new unauthenticated session (step 1). */
export async function createPreAuthSession(): Promise<string> {
  const client = new TelegramClient(new StringSession(''), TG_API_ID, TG_API_HASH, clientOptions())
  await client.connect()
  const saved = client.session.save() as unknown as string
  await client.disconnect()
  return saved
}

/**
 * Create a client bound to a stored session string (pre-auth or authorized).
 * The caller is responsible for disconnecting.
 */
export async function clientFromSession(sessionString: string): Promise<TelegramClient> {
  const client = new TelegramClient(new StringSession(sessionString), TG_API_ID, TG_API_HASH, clientOptions())
  await client.connect()
  return client
}

/**
 * Fetch a fresh login token for the app to accept.
 * Returns base64 of the token bytes (valid ~30 seconds).
 * Throws when the session is already authorized.
 */
export async function exportLoginToken(sessionString: string): Promise<string> {
  const client = await clientFromSession(sessionString)
  try {
    const res = await client.invoke(
      new Api.auth.ExportLoginToken({
        apiId: TG_API_ID,
        apiHash: TG_API_HASH,
        exceptIds: []
      })
    )
    if (res instanceof Api.auth.LoginToken) {
      return Buffer.from(res.token).toString('base64')
    }
    if (res instanceof Api.auth.LoginTokenSuccess) {
      throw new Error('SESSION_ALREADY_AUTHORIZED')
    }
    throw new Error('UNEXPECTED_LOGIN_TOKEN_RESPONSE')
  } finally {
    await client.disconnect().catch(() => {})
  }
}

/**
 * Complete the login after the app accepted the token: poll exportLoginToken
 * once more — it now returns auth.loginTokenSuccess with the authorization.
 * Returns the authorized StringSession.
 */
export async function completeLoginToken(sessionString: string): Promise<string> {
  const client = await clientFromSession(sessionString)
  try {
    const res = await client.invoke(
      new Api.auth.ExportLoginToken({
        apiId: TG_API_ID,
        apiHash: TG_API_HASH,
        exceptIds: []
      })
    )
    if (res instanceof Api.auth.LoginTokenSuccess) {
      return client.session.save() as unknown as string
    }
    // still a plain token → the app's accept didn't land (yet)
    throw new Error('ACCEPT_NOT_CONFIRMED')
  } finally {
    await client.disconnect().catch(() => {})
  }
}

/** Best-effort logout of an authorized session. */
export async function logoutSession(sessionString: string): Promise<void> {
  try {
    const client = await clientFromSession(sessionString)
    try {
      await client.invoke(new Api.auth.LogOut())
    } finally {
      await client.disconnect().catch(() => {})
    }
  } catch {
    // best-effort — revoking the DB row is what matters
  }
}

// ---------- account explorer helpers ----------

export interface DialogItem {
  key: string
  id: string
  type: 'user' | 'group' | 'channel' | 'bot'
  title: string
  username?: string | null
  lastMessage?: string | null
  lastMessageAt?: string | null
  unreadCount: number
  verified?: boolean
}

export interface MessageItem {
  id: number
  out: boolean
  date: string
  text: string
  sender?: string | null
}

/** base64(JSON) peer descriptor passed between panel routes. */
export function encodePeer(kind: string, id: string, accessHash: string | null): string {
  return Buffer.from(JSON.stringify({ kind, id, accessHash })).toString('base64')
}

export function decodePeer(key: string): Api.TypeInputPeer {
  const { kind, id, accessHash } = JSON.parse(Buffer.from(key, 'base64').toString('utf-8'))
  if (kind === 'user') {
    return new Api.InputPeerUser({ userId: bigInt(id), accessHash: bigInt(accessHash ?? 0) })
  }
  if (kind === 'channel') {
    return new Api.InputPeerChannel({ channelId: bigInt(id), accessHash: bigInt(accessHash ?? 0) })
  }
  return new Api.InputPeerChat({ chatId: bigInt(id) })
}

export async function getDialogs(sessionString: string, limit = 40): Promise<DialogItem[]> {
  const client = await clientFromSession(sessionString)
  try {
    // client.getDialogs returns the CUSTOM Dialog wrapper (has .entity/.name/.message)
    const res = await client.getDialogs({ limit })
    const items: DialogItem[] = []
    for (const d of res) {
      const entity = d.entity
      if (!entity) continue

      let type: DialogItem['type'] = 'group'
      let username: string | null = null
      let verified = false
      let peerKey: string

      if (entity instanceof Api.User) {
        type = entity.bot ? 'bot' : 'user'
        username = entity.username ?? null
        verified = !!entity.verified
        peerKey = encodePeer('user', entity.id.toString(), entity.accessHash?.toString() ?? null)
      } else if (entity instanceof Api.Channel) {
        type = entity.broadcast ? 'channel' : 'group'
        username = entity.username ?? null
        verified = !!entity.verified
        peerKey = encodePeer('channel', entity.id.toString(), entity.accessHash?.toString() ?? null)
      } else {
        // basic chats (and forbidden variants) have no reliable username
        username = (entity as { username?: string }).username ?? null
        peerKey = encodePeer('chat', entity.id.toString(), null)
      }

      const last = d.message
      items.push({
        key: peerKey,
        id: entity.id.toString(),
        type,
        title: d.name || d.title || 'بدون نام',
        username,
        lastMessage: last?.message ?? null,
        lastMessageAt: last?.date ? new Date((last.date as number) * 1000).toISOString() : null,
        unreadCount: d.unreadCount ?? 0,
        verified
      })
    }
    return items
  } finally {
    await client.disconnect().catch(() => {})
  }
}

export async function getHistory(sessionString: string, peerKey: string, limit = 50, offsetId = 0): Promise<MessageItem[]> {
  const client = await clientFromSession(sessionString)
  try {
    const peer = decodePeer(peerKey)
    const res = await client.getMessages(peer, { limit, offsetId: offsetId || undefined })
    const items: MessageItem[] = []
    for (const m of res) {
      const msg = m as Api.Message
      items.push({
        id: msg.id,
        out: !!msg.out,
        date: new Date((msg.date as number) * 1000).toISOString(),
        text: msg.message ?? (msg.media ? '[رسانه]' : ''),
        sender: msg.post ? 'کانال' : undefined
      })
    }
    return items
  } finally {
    await client.disconnect().catch(() => {})
  }
}

export async function sendMessage(sessionString: string, peerKey: string, text: string): Promise<number> {
  const client = await clientFromSession(sessionString)
  try {
    const peer = decodePeer(peerKey)
    const res = await client.sendMessage(peer, { message: text })
    return (res as Api.Message).id
  } finally {
    await client.disconnect().catch(() => {})
  }
}
