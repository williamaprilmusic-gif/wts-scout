import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, assertSameOrigin, authErrorStatus } from '../api/_lib/auth.js';

const password = 'WTS Scout test password 2026!';
const encoded = await hashPassword(password);
assert.equal(await verifyPassword(password, encoded), true, 'valid password should verify');
assert.equal(await verifyPassword('wrong password', encoded), false, 'wrong password should fail');
assert.equal(await verifyPassword('short', encoded), false, 'invalid password should fail safely');

const sameOriginRequest = {
  method: 'POST',
  url: 'https://wts-scout.example/api/auth',
  headers: new Headers({ origin: 'https://wts-scout.example', 'sec-fetch-site': 'same-origin' }),
};
assert.doesNotThrow(() => assertSameOrigin(sameOriginRequest));

const crossOriginRequest = {
  method: 'POST',
  url: 'https://wts-scout.example/api/auth',
  headers: new Headers({ origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }),
};
assert.throws(() => assertSameOrigin(crossOriginRequest), (error) => error?.status === 403);

assert.equal(authErrorStatus(Object.assign(new Error('forbidden'), { status: 403 })), 403);
assert.equal(authErrorStatus(new Error('unknown')), 500);

console.log('WTS Scout auth checks passed.');
