import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SALT_LEN = 16;
const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN);
  const key = scryptSync(password, salt, KEY_LEN);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  try {
    const salt = Buffer.from(saltHex, "hex");
    const key = Buffer.from(keyHex, "hex");
    const test = scryptSync(password, salt, KEY_LEN);
    if (key.length !== test.length) return false;
    return timingSafeEqual(key, test);
  } catch {
    return false;
  }
}
