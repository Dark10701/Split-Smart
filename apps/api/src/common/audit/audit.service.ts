import { Injectable, Logger } from '@nestjs/common';

/** A security-relevant action worth an audit trail entry (M6-02). */
export type AuditAction =
  | 'member.added'
  | 'member.removed'
  | 'settlement.recorded'
  | 'account.exported'
  | 'account.deleted';

export interface AuditEntry {
  /** Internal user id of the actor, or null for a system action. */
  actorUserId: string | null;
  action: AuditAction;
  /** What was acted on (e.g. 'group_member', 'user', 'payment'). */
  targetType: string;
  targetId: string;
  groupId?: string;
  /** Extra non-PII context (amounts, roles). Never secrets or raw PII. */
  metadata?: Record<string, unknown>;
}

/**
 * Structured audit logging for sensitive actions (M6-02).
 *
 * Emits a single-line JSON record tagged `audit:true` so centralized logging /
 * SIEM can filter and retain the security trail independently of app logs. This
 * complements the per-group ActivityLog (which is the user-facing financial
 * history); the audit stream is for security/compliance review and covers
 * cross-cutting, non-group events like account export and deletion.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  record(entry: AuditEntry): void {
    this.logger.log(JSON.stringify({ audit: true, ts: new Date().toISOString(), ...entry }));
  }
}
