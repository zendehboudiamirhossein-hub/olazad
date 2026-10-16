import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/client/version
 * Update check endpoint for the AzadGram client.
 *
 * Optional query: ?currentVersionCode=71759
 * When provided, the response includes updateAvailable / updateRequired so
 * the client can decide without comparing strings.
 */
export async function GET(request: NextRequest) {
  const release = await db.appRelease.findFirst({
    where: { isActive: true },
    orderBy: { versionCode: 'desc' }
  })
  if (!release) {
    return NextResponse.json({ message: 'No release published' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const currentCode = parseInt(searchParams.get('currentVersionCode') ?? '', 10)

  return NextResponse.json({
    version: release.version,
    versionCode: release.versionCode,
    downloadUrl: release.downloadUrl,
    changelog: release.changelog,
    minAndroid: release.minAndroid,
    forceUpdate: release.forceUpdate,
    releasedAt: release.releasedAt,
    updateAvailable: Number.isFinite(currentCode) ? release.versionCode > currentCode : undefined,
    updateRequired: Number.isFinite(currentCode)
      ? release.forceUpdate && release.versionCode > currentCode
      : undefined
  })
}
