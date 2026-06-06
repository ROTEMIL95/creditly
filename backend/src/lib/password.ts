// Password hashing with PBKDF2 via Web Crypto. Runs identically on Node (global `crypto`)
// and Cloudflare Workers. bcrypt was replaced because its pure-JS cost exceeds the Workers
// free-plan CPU budget on login; WebCrypto PBKDF2 is native and fast on both runtimes.
//
// Stored format (self-describing, so params can change without a migration):
//   pbkdf2$<iterations>$<saltBase64>$<hashBase64>

const ITERATIONS = 100_000;
const KEY_LEN = 32; // derived key bytes
const SALT_LEN = 16; // salt bytes
const DIGEST = 'SHA-256';

const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function derive(plain: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(plain),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: DIGEST },
    key,
    KEY_LEN * 8,
  );
  return new Uint8Array(bits);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const hash = await derive(plain, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [scheme, iterStr, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iterStr || !saltB64 || !hashB64) return false;
  const iterations = Number(iterStr);
  if (!Number.isInteger(iterations) || iterations <= 0) return false;
  const expected = fromBase64(hashB64);
  const actual = await derive(plain, fromBase64(saltB64), iterations);
  return timingSafeEqual(actual, expected);
}
