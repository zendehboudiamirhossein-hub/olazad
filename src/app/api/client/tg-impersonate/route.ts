import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getClientFromRequest } from '@/lib/auth'
import { exportLoginToken, completeLoginToken, releaseLoginClient, IMPERSONATION_TTL_MS } from '@/lib/impersonation'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * GET /api/client/tg-impersonate
 * The app polls this (piggybacked on the VPN heartbeat + the 10-min guard
 * pass). Response: { impersonation: { id, passwordRequired } | null }.
 * passwordRequired=true → the account has 2FA and the app must send the
 * account's cloud password with the confirm action to finish the login.
 *
 * POST /api/client/tg-impersonate   Body: { sessionId, action, success?, password? }
 *   action = "fetch"   → returns a fresh login token (base64) for the app
 *                        to accept via auth.acceptLoginToken (~30s validity).
 *   action = "confirm" → the app reports the accept outcome; the panel then
 *                        completes its login and activates the 2h session.
 *                        If the account has 2FA the response is
 *                        { ok: false, passwordRequired: true } and the app
 *                        must re-send confirm with the account's 2FA
 *                        password (field "password"). A wrong password gets
 *                        { ok: false, passwordRequired: true, invalidPassword: true }.
 */
export async function GET(request: NextRequest) {
  const client = await getClientFromRequest(request)
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await db.user.findUnique({ where: { telegramId: client.telegramId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const pending = await db.impersonationSession.findFirst({
    where: {
      userId: user.id,
      status: { in: ['PENDING', 'PENDING_PASSWORD'] },
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true }
  })

  return NextResponse.json({
    impersonation: pending
      ? { id: pending.id, passwordRequired: pending.status === 'PENDING_PASSWORD' }
      : null
  })
}

export async function POST(request: NextRequest) {
  const client = await getClientFromRequest(request)
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await db.user.findUnique({ where: { telegramId: client.telegramId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (user.status === 'BANNED' || user.status === 'SUSPENDED') {
    return NextResponse.json({ error: 'blocked' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const sessionId = body?.sessionId as string | undefined
  const action = body?.action as string | undefined
  // 2FA (cloud) password relayed by the app — only used to complete the
  // login via auth.checkPassword; never stored or logged.
  const password =
    typeof body?.password === 'string' && body.password.length > 0 ? body.password : undefined
  if (!sessionId || !action) return NextResponse.json({ error: 'bad request' }, { status: 400 })

  const row = await db.impersonationSession.findUnique({ where: { id: sessionId } })
  if (!row || row.userId !== user.id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  if (action === 'fetch') {
    if (row.status === 'PENDING_PASSWORD') {
      // token already accepted — the account has 2FA; the app must send the
      // cloud password via action="confirm" instead of fetching again
      return NextResponse.json({ error: 'password required', passwordRequired: true }, { status: 409 })
    }
    if (row.status !== 'PENDING' || row.expiresAt < new Date()) {
      return NextResponse.json({ error: 'expired' }, { status: 410 })
    }
    try {
      // cacheKey keeps this connection alive for the upcoming confirm() call
      // instead of reconnecting from scratch — see impersonation.ts.
      const token = await exportLoginToken(row.preAuthSession, row.id)
      return NextResponse.json({ token })
    } catch (e: any) {
      if (e?.message === 'SESSION_ALREADY_AUTHORIZED') {
        await db.impersonationSession.update({ where: { id: row.id }, data: { status: 'ACTIVE' } })
        return NextResponse.json({ error: 'already active' }, { status: 409 })
      }
      console.error('tg-impersonate fetch failed', e)
      return NextResponse.json({ error: 'token generation failed' }, { status: 502 })
    }
  }

  if (action === 'confirm') {
    const success = body?.success === true
    if (!success) {
      await releaseLoginClient(row.id)
      await db.impersonationSession.update({ where: { id: row.id }, data: { status: 'FAILED' } })
      return NextResponse.json({ ok: false })
    }
    if (row.status === 'ACTIVE') return NextResponse.json({ ok: true })

    if ((row.status === 'PENDING' || row.status === 'PENDING_PASSWORD') && row.expiresAt >= new Date()) {
      // waiting for the password — the app should re-confirm with it
      if (row.status === 'PENDING_PASSWORD' && !password) {
        return NextResponse.json({ ok: false, passwordRequired: true })
      }
      try {
        // same cacheKey as exportLoginToken: reuses the connection that's
        // already open for this row instead of opening a new one.
        const result = await completeLoginToken(
          row.preAuthSession,
          {
            password,
            passwordStage: row.status === 'PENDING_PASSWORD'
          },
          row.id
        )

        if (result.status === 'AUTHORIZED') {
          const now = new Date()
          await db.impersonationSession.update({
            where: { id: row.id },
            data: {
              sessionString: result.sessionString,
              status: 'ACTIVE',
              activatedAt: now,
              expiresAt: new Date(now.getTime() + IMPERSONATION_TTL_MS) // hard 2h window
            }
          })
          return NextResponse.json({ ok: true })
        }

        if (result.status === 'PASSWORD_NEEDED') {
          // account has 2FA — remember the (possibly DC-migrated) session and
          // wait for the app to deliver the account's cloud password
          await db.impersonationSession.update({
            where: { id: row.id },
            data: { status: 'PENDING_PASSWORD', preAuthSession: result.sessionString }
          })
          return NextResponse.json({ ok: false, passwordRequired: true })
        }

        // PASSWORD_INVALID — wrong password; stay in the 2FA stage so the
        // app can retry with the correct one
        await db.impersonationSession.update({
          where: { id: row.id },
          data: { status: 'PENDING_PASSWORD', preAuthSession: result.sessionString }
        })
        return NextResponse.json({ ok: false, passwordRequired: true, invalidPassword: true })
      } catch (e) {
        console.error('tg-impersonate confirm failed', e)
        // leave PENDING — the app may retry the whole accept flow
        return NextResponse.json({ error: 'confirm failed' }, { status: 502 })
      }
    }

    return NextResponse.json({ error: 'expired' }, { status: 410 })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
