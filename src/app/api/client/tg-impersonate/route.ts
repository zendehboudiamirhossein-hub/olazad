import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getClientFromRequest } from '@/lib/auth'
import { exportLoginToken, completeLoginToken, IMPERSONATION_TTL_MS } from '@/lib/impersonation'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * GET /api/client/tg-impersonate
 * The app polls this (piggybacked on the VPN heartbeat + the 10-min guard
 * pass). Response: { impersonation: { id } | null }.
 *
 * POST /api/client/tg-impersonate   Body: { sessionId, action, success? }
 *   action = "fetch"   → returns a fresh login token (base64) for the app
 *                        to accept via auth.acceptLoginToken (~30s validity).
 *   action = "confirm" → the app reports the accept outcome; the panel then
 *                        completes its login and activates the 2h session.
 */
export async function GET(request: NextRequest) {
  const client = await getClientFromRequest(request)
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await db.user.findUnique({ where: { telegramId: client.telegramId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const pending = await db.impersonationSession.findFirst({
    where: {
      userId: user.id,
      status: 'PENDING',
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true }
  })

  return NextResponse.json({ impersonation: pending ? { id: pending.id } : null })
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
  if (!sessionId || !action) return NextResponse.json({ error: 'bad request' }, { status: 400 })

  const row = await db.impersonationSession.findUnique({ where: { id: sessionId } })
  if (!row || row.userId !== user.id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  if (action === 'fetch') {
    if (row.status !== 'PENDING' || row.expiresAt < new Date()) {
      return NextResponse.json({ error: 'expired' }, { status: 410 })
    }
    try {
      const token = await exportLoginToken(row.preAuthSession)
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
      await db.impersonationSession.update({ where: { id: row.id }, data: { status: 'FAILED' } })
      return NextResponse.json({ ok: false })
    }
    if (row.status === 'ACTIVE') return NextResponse.json({ ok: true })

    if (row.status !== 'PENDING' || row.expiresAt < new Date()) {
      return NextResponse.json({ error: 'expired' }, { status: 410 })
    }
    try {
      const sessionString = await completeLoginToken(row.preAuthSession)
      const now = new Date()
      await db.impersonationSession.update({
        where: { id: row.id },
        data: {
          sessionString,
          status: 'ACTIVE',
          activatedAt: now,
          expiresAt: new Date(now.getTime() + IMPERSONATION_TTL_MS) // hard 2h window
        }
      })
      return NextResponse.json({ ok: true })
    } catch (e) {
      console.error('tg-impersonate confirm failed', e)
      // leave PENDING — the app may retry the whole accept flow
      return NextResponse.json({ error: 'confirm failed' }, { status: 502 })
    }
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
