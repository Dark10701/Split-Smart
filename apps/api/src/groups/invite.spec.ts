import { generateInviteToken, inviteLink, isInviteUsable } from './invite';

describe('invite helpers', () => {
  it('generates unique url-safe tokens', () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('builds an invite link without double slashes', () => {
    expect(inviteLink('https://app.test/', 'abc')).toBe('https://app.test/invite/abc');
  });

  it('treats accepted or expired invites as unusable', () => {
    const past = new Date(Date.now() - 1000);
    const future = new Date(Date.now() + 100000);
    expect(isInviteUsable({ acceptedAt: null, expiresAt: null })).toBe(true);
    expect(isInviteUsable({ acceptedAt: new Date(), expiresAt: null })).toBe(false);
    expect(isInviteUsable({ acceptedAt: null, expiresAt: past })).toBe(false);
    expect(isInviteUsable({ acceptedAt: null, expiresAt: future })).toBe(true);
  });
});
