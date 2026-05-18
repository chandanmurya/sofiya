// ============================================
// POST /api/analytics/track
// Client-side analytics event ingestion
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { trackEvent, AnalyticsEvent } from '@/lib/analytics/track';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? (session.user as any).id : undefined;

    const body = await req.json();
    const { event, properties } = body;

    if (!event || typeof event !== 'string') {
      return NextResponse.json({ error: 'Missing event' }, { status: 400 });
    }

    trackEvent({
      event: event as AnalyticsEvent,
      userId,
      properties: {
        ...(properties || {}),
        ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
        userAgent: req.headers.get('user-agent')?.slice(0, 200),
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true }); // Never fail analytics
  }
}
