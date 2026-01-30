/**
 * API Key Encryption Utility
 *
 * Uses AES-256-GCM for secure encryption of user API keys.
 * Compatible with Cloudflare Workers (Web Crypto API).
 */

export interface EncryptedData {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
}

/**
 * Derives an AES-256 key from the master key string
 */
async function deriveKey(masterKey: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(masterKey);

  // Use SHA-256 to get a consistent 32-byte key from the master key
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);

  return crypto.subtle.importKey('raw', hashBuffer, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Encrypts an API key using AES-256-GCM
 *
 * @param plaintext - The API key to encrypt
 * @param masterKey - The server's encryption master key
 * @returns Encrypted data object containing ciphertext, IV, and auth tag
 */
export async function encryptApiKey(plaintext: string, masterKey: string): Promise<EncryptedData> {
  if (!masterKey) {
    throw new Error('Encryption master key is required');
  }

  const key = await deriveKey(masterKey);
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate a random 12-byte IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt with AES-256-GCM (auth tag is automatically appended)
  const encryptedBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);

  // The encrypted buffer contains ciphertext + 16-byte auth tag
  const encryptedArray = new Uint8Array(encryptedBuffer);
  const ciphertext = encryptedArray.slice(0, -16);
  const authTag = encryptedArray.slice(-16);

  return {
    ciphertext: btoa(String.fromCharCode(...ciphertext)),
    iv: btoa(String.fromCharCode(...iv)),
    authTag: btoa(String.fromCharCode(...authTag)),
  };
}

/**
 * Decrypts an encrypted API key
 *
 * @param encrypted - The encrypted data object
 * @param masterKey - The server's encryption master key
 * @returns The decrypted API key
 */
export async function decryptApiKey(encrypted: EncryptedData, masterKey: string): Promise<string> {
  if (!masterKey) {
    throw new Error('Encryption master key is required');
  }

  const key = await deriveKey(masterKey);

  // Decode base64 strings
  const ciphertext = Uint8Array.from(atob(encrypted.ciphertext), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(encrypted.iv), (c) => c.charCodeAt(0));
  const authTag = Uint8Array.from(atob(encrypted.authTag), (c) => c.charCodeAt(0));

  // Concatenate ciphertext and auth tag for decryption
  const encryptedData = new Uint8Array(ciphertext.length + authTag.length);
  encryptedData.set(ciphertext);
  encryptedData.set(authTag, ciphertext.length);

  // Decrypt
  const decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encryptedData);

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Parses a stored encrypted key JSON string into EncryptedData
 *
 * @param storedKey - JSON string from database
 * @returns EncryptedData object or null if invalid
 */
export function parseEncryptedKey(storedKey: string | null): EncryptedData | null {
  if (!storedKey) return null;

  try {
    const parsed = JSON.parse(storedKey);
    if (parsed.ciphertext && parsed.iv && parsed.authTag) {
      return parsed as EncryptedData;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Serializes EncryptedData to a JSON string for database storage
 *
 * @param encrypted - The encrypted data object
 * @returns JSON string
 */
export function serializeEncryptedKey(encrypted: EncryptedData): string {
  return JSON.stringify(encrypted);
}
