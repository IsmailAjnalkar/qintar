/**
 * Password hashing for the built-in (keyless-staging) auth provider — QIN-25.
 *
 * scrypt (memory-hard KDF, in node:crypto — no dependency) with a per-password
 * random salt. Stored format: `scrypt:<saltB64>:<hashB64>`. Verification is
 * constant-time. When an external IdP (Clerk/Google) is the provider, users
 * have a null hash and never hit this path.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const PREFIX = "scrypt";
const KEYLEN = 64;
const SALT_BYTES = 16;

export const MIN_PASSWORD_LENGTH = 8;

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(plain, salt, KEYLEN);
  return `${PREFIX}:${salt.toString("base64")}:${derived.toString("base64")}`;
}

/**
 * Verify a plaintext password against a stored hash. Returns false (never
 * throws) for a null/malformed stored value so callers can treat "no user" and
 * "wrong password" identically without leaking which one it was.
 */
export async function verifyPassword(
  plain: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== PREFIX) return false;
  const salt = Buffer.from(parts[1], "base64");
  const expected = Buffer.from(parts[2], "base64");
  if (expected.length === 0) return false;
  let derived: Buffer;
  try {
    derived = await scrypt(plain, salt, expected.length);
  } catch {
    return false;
  }
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
