import { claimsToUserUpsert } from './claims';

describe('claimsToUserUpsert', () => {
  it('uses provided name and lowercases email', () => {
    expect(claimsToUserUpsert({ sub: 'auth0|9', email: 'Sam@Example.com', name: 'Sam' })).toEqual({
      authSubject: 'auth0|9',
      email: 'sam@example.com',
      name: 'Sam',
    });
  });

  it('falls back to email local-part when name is missing', () => {
    expect(claimsToUserUpsert({ sub: 'g|1', email: 'maya@x.com' }).name).toBe('maya');
  });
});
