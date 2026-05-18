// ============================================
// Simple Audit Log
// ============================================
// Logs sensitive actions for compliance and debugging.
// Stored in WebhookLog table (reusing existing model) with source='audit'.

import { prisma } from '@/lib/prisma';

export type AuditAction =
  | 'user.registered'
  | 'user.login'
  | 'user.delete_requested'
  | 'subscription.created'
  | 'subscription.cancelled'
  | 'avatar.created'
  | 'avatar.deleted'
  | 'voice.created'
  | 'voice.deleted'
  | 'video.generated'
  | 'video.downloaded'
  | 'credits.deducted'
  | 'credits.refunded'
  | 'topup.purchased'
  | 'addon.purchased'
  | 'admin.action';

interface AuditEntry {
  action: AuditAction;
  userId: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}

/**
 * Log an audit event. Fire-and-forget (non-blocking).
 */
export function logAudit(entry: AuditEntry): void {
  // Fire and forget — don't await
  prisma.webhookLog.create({
    data: {
      source: 'audit',
      eventType: entry.action,
      payload: {
        userId: entry.userId,
        ip: entry.ipAddress || 'unknown',
        timestamp: new Date().toISOString(),
        ...entry.metadata,
      } as any,
      status: 'processed',
      processedAt: new Date(),
    },
  }).catch((err) => {
    console.error('[AuditLog] Failed to write:', err.message);
  });
}

/**
 * Extract IP from Next.js request.
 */
export function getClientIP(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         headers.get('x-real-ip') ||
         'unknown';
}
