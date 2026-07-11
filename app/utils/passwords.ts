import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Password hashing with scrypt from node:crypto — no external dependency.
// Stored format: `scrypt$<saltHex>$<hashHex>`.

const KEY_LENGTH = 64;

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  let salt = randomBytes(16);
  let hash = await scryptAsync(password, salt);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  let parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  let salt = Buffer.from(parts[1]!, "hex");
  let expected = Buffer.from(parts[2]!, "hex");
  let actual = await scryptAsync(password, salt);
  // Lengths must match before timingSafeEqual, and the comparison is constant
  // time to avoid leaking information about the stored hash.
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
