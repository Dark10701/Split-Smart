import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../database/prisma.service';
import { defaultNotificationPrefs } from './notification-defaults';

describe('UsersService', () => {
  const claims = { sub: 'auth0|42', email: 'Maya@Example.com', name: 'Maya' };

  function build(prismaMock: Partial<Record<string, unknown>>) {
    return Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: { user: prismaMock } }],
    }).compile();
  }

  it('returns the existing user without creating', async () => {
    const existing = { id: 'u1', authSubject: 'auth0|42', email: 'maya@example.com', name: 'Maya' };
    const create = jest.fn();
    const mod = await build({ findUnique: jest.fn().mockResolvedValue(existing), create });
    const svc = mod.get(UsersService);
    await expect(svc.resolveFromClaims(claims)).resolves.toEqual(existing);
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a user with seeded prefs on first sign-in', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'u2' });
    const mod = await build({ findUnique: jest.fn().mockResolvedValue(null), create });
    const svc = mod.get(UsersService);
    await svc.resolveFromClaims(claims);
    const arg = create.mock.calls[0][0];
    expect(arg.data.authSubject).toBe('auth0|42');
    expect(arg.data.email).toBe('maya@example.com');
    expect(arg.data.notificationPrefs.create).toHaveLength(defaultNotificationPrefs('').length);
  });
});
