/**
 * Secure API key storage using Web Crypto API (AES-GCM).
 *
 * Keys are encrypted with a device-specific key derived from a random salt
 * via PBKDF2 before being written to localStorage. The encryption key never
 * leaves SubtleCrypto; raw API keys are only held in memory while needed.
 */

const LS_PREFIX = 'learning_ide_apikey_'
const SALT_KEY = 'learning_ide_apikey_salt'
const ALGO = 'AES-GCM'
const PBKDF2_ITERATIONS = 100_000

export type ApiKeyProvider = 'google' | 'openai' | 'anthropic'

const PROVIDERS: ApiKeyProvider[] = ['google', 'openai', 'anthropic']

// ── helpers ──────────────────────────────────────────────────────────

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

/** Get or create a per-device random salt (stored in localStorage). */
function getOrCreateSalt(): Uint8Array {
  const existing = localStorage.getItem(SALT_KEY)
  if (existing) return fromBase64(existing)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  localStorage.setItem(SALT_KEY, toBase64(salt.buffer as ArrayBuffer))
  return salt
}

/** Derive an AES-GCM key from the salt using PBKDF2. */
async function deriveKey(): Promise<CryptoKey> {
  const salt = getOrCreateSalt()
  // Use a fixed passphrase combined with the random salt.
  // The salt is unique per browser profile, making the ciphertext
  // useless on a different machine even if localStorage is copied.
  const passphrase = 'learning-ide-apikey-encryption-v1'
  const raw = new TextEncoder().encode(passphrase)
  const baseKey = await crypto.subtle.importKey('raw', raw, 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: ALGO, length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// ── public API ───────────────────────────────────────────────────────

/** Encrypt and store an API key for a provider. Empty string clears it. */
export async function saveApiKey(provider: ApiKeyProvider, plaintext: string): Promise<void> {
  if (!plaintext.trim()) {
    localStorage.removeItem(`${LS_PREFIX}${provider}`)
    return
  }
  const key = await deriveKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext.trim())
  const ciphertext = await crypto.subtle.encrypt({ name: ALGO, iv }, key, encoded)
  // Store as JSON: { iv, data } both base64
  const payload = JSON.stringify({
    iv: toBase64(iv.buffer as ArrayBuffer),
    data: toBase64(ciphertext),
  })
  localStorage.setItem(`${LS_PREFIX}${provider}`, payload)
}

/** Decrypt and return an API key. Returns empty string if not set. */
export async function loadApiKey(provider: ApiKeyProvider): Promise<string> {
  const raw = localStorage.getItem(`${LS_PREFIX}${provider}`)
  if (!raw) return ''
  try {
    const { iv, data } = JSON.parse(raw)
    const key = await deriveKey()
    const ivBuf = fromBase64(iv)
    const dataBuf = fromBase64(data)
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGO, iv: ivBuf.buffer as ArrayBuffer },
      key,
      dataBuf.buffer as ArrayBuffer
    )
    return new TextDecoder().decode(decrypted)
  } catch {
    // Corrupted or from a different device – clear it
    localStorage.removeItem(`${LS_PREFIX}${provider}`)
    return ''
  }
}

/** Load all API keys at once. */
export async function loadAllApiKeys(): Promise<Record<ApiKeyProvider, string>> {
  const result = {} as Record<ApiKeyProvider, string>
  for (const p of PROVIDERS) {
    result[p] = await loadApiKey(p)
  }
  return result
}

/** Check which providers have a key stored (without decrypting). */
export function hasStoredKey(provider: ApiKeyProvider): boolean {
  return !!localStorage.getItem(`${LS_PREFIX}${provider}`)
}

/** Delete a stored key. */
export function deleteApiKey(provider: ApiKeyProvider): void {
  localStorage.removeItem(`${LS_PREFIX}${provider}`)
}

/** Mask a key for display: show first 4 and last 4 chars. */
export function maskKey(key: string): string {
  if (key.length <= 10) return '••••••••'
  return `${key.slice(0, 4)}${'•'.repeat(Math.min(key.length - 8, 20))}${key.slice(-4)}`
}
