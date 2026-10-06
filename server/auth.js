// Password hashing and session tokens.
import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LEN = 64;
export const SESSION_DAYS = 30;

export async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const buf = await scryptAsync(password, salt, KEY_LEN);
  return { hash: buf.toString('hex'), salt };
}

export async function verifyPassword(password, salt, expectedHex) {
  const buf = await scryptAsync(password, salt, KEY_LEN);
  const expected = Buffer.from(expectedHex, 'hex');
  return expected.length === buf.length && timingSafeEqual(buf, expected);
}

export function newToken() {
  return randomBytes(32).toString('base64url');
}

// Only a hash of the session token is stored, so a leaked DB can't be used to log in.
export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return 'Password must be 8–128 characters.';
  }
  return null;
}

export function validateCredentials(username, password) {
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    return 'Username must be 3–16 letters, numbers or underscores.';
  }
  return validatePassword(password);
}
