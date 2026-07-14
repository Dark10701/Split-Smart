import { Logger } from '@nestjs/common';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('emits a structured, audit-tagged JSON line for a sensitive action', () => {
    const spy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    new AuditService().record({
      actorUserId: 'u1',
      action: 'account.deleted',
      targetType: 'user',
      targetId: 'u1',
      metadata: { anonymizedMemberships: 2 },
    });
    const line = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.audit).toBe(true);
    expect(parsed.action).toBe('account.deleted');
    expect(parsed.actorUserId).toBe('u1');
    expect(parsed.metadata.anonymizedMemberships).toBe(2);
    expect(typeof parsed.ts).toBe('string');
    spy.mockRestore();
  });
});
