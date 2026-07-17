import { claimsToUserUpsert } from './claims';

describe('claimsToUserUpsert', () => {
  it('uses provided name and lowercases email', () => {
    expect(
      claimsToUserUpsert({
        sub: 'auth0|9',
        email: 'Sam@Example.com',
        name: 'Sam',
        email_verified: true as const,
      }),
    ).toEqual({
      authSubject: 'auth0|9',
      email: 'sam@example.com',
      name: 'Sam',
      phone: null,
    });
  });

  it('normalizes the phone_number claim and rejects invalid ones', () => {
    expect(
      claimsToUserUpsert({
        sub: 'a|1',
        email: 'x@y.com',
        email_verified: true as const,
        phone_number: '98765 43210',
      }).phone,
    ).toBe('+919876543210');
    expect(
      claimsToUserUpsert({
        sub: 'a|1',
        email: 'x@y.com',
        email_verified: true as const,
        phone_number: 'garbage',
      }).phone,
    ).toBeNull();
  });

  it('falls back to email local-part when name is missing', () => {
    expect(
      claimsToUserUpsert({ sub: 'g|1', email: 'maya@x.com', email_verified: true as const }).name,
    ).toBe('maya');
  });
});
