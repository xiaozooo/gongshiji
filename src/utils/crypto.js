/**
 * AES-GCM 256-bit encryption/decryption via Web Crypto API
 * Format: base64( salt(16) | iv(12) | ciphertext )
 */

const PBKDF2_ITERATIONS = 100_000
const SALT_LEN = 16
const IV_LEN = 12

async function deriveKey(password, salt) {
    const enc = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
        'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
    )
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, hash: 'SHA-256', iterations: PBKDF2_ITERATIONS },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    )
}

function toBase64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function fromBase64(str) {
    return Uint8Array.from(atob(str), c => c.charCodeAt(0))
}

export async function encryptBackup(jsonStr, password) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN))
    const iv = crypto.getRandomValues(new Uint8Array(IV_LEN))
    const key = await deriveKey(password, salt)
    const data = new TextEncoder().encode(jsonStr)
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)

    const combined = new Uint8Array(SALT_LEN + IV_LEN + ciphertext.byteLength)
    combined.set(salt, 0)
    combined.set(iv, SALT_LEN)
    combined.set(new Uint8Array(ciphertext), SALT_LEN + IV_LEN)
    return toBase64(combined.buffer)
}

export async function decryptBackup(encrypted, password) {
    const combined = fromBase64(encrypted)
    const salt = combined.slice(0, SALT_LEN)
    const iv = combined.slice(SALT_LEN, SALT_LEN + IV_LEN)
    const ciphertext = combined.slice(SALT_LEN + IV_LEN)
    const key = await deriveKey(password, salt)
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
    return new TextDecoder().decode(decrypted)
}
