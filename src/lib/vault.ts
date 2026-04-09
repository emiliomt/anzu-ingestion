// Anzu Dynamics — Encrypted ERP Credential Vault
// AES-256-GCM symmetric encryption for storing ERP login credentials per tenant.
// The decryption key lives exclusively in VAULT_KEY env var — never in the database.
//
// Usage pattern:
//   Store:   const payload = encryptCredential(JSON.stringify({ user, password }))
//   Retrieve: const { user, password } = JSON.parse(decryptCredential(payload))
//
// Upgrade path: replace getKey() with an AWS KMS / GCP Cloud KMS call for
// envelope encryption in production. The VaultPayload interface stays the same.

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // bytes — 256 bits
const IV_LENGTH = 12;  // bytes — 96-bit IV recommended for GCM

/** Encrypted credential blob stored in ErpCredential.encryptedData / iv / authTag */
export interface VaultPayload {
  encryptedData: string; // base64-encoded ciphertext
  iv: string;            // base64-encoded 96-bit IV
  authTag: string;       // base64-encoded 128-bit GCM authentication tag
}

/** Shape of the plaintext JSON stored inside the vault */
export interface ErpCredentialData {
  username?: string;
  password?: string;
  apiKey?: string;
  baseUrl?: string;
  tenantCode?: string;   // e.g. SINCO empresa code
  extra?: Record<string, string>; // ERP-specific fields
}

function getKey(): Buffer {
  const hex = process.env.VAULT_KEY;
  if (!hex) {
    throw new Error(
      "VAULT_KEY environment variable is not set. " +
      "Generate one with: openssl rand -hex 32"
    );
  }
  if (hex.length !== KEY_LENGTH * 2) {
    throw new Error(
      `VAULT_KEY must be exactly ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes / 256 bits). ` +
      `Got ${hex.length} characters.`
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * A fresh random IV is generated for every call — safe to call for every credential.
 */
export function encryptCredential(plaintext: string): VaultPayload {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return {
    encryptedData: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

/**
 * Decrypts an AES-256-GCM ciphertext payload back to its plaintext.
 * Throws if the auth tag is invalid (tampered data / wrong key).
 */
export function decryptCredential(payload: VaultPayload): string {
  const key = getKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(payload.encryptedData, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Convenience: encrypt a typed credential object.
 */
export function encryptErpCredential(data: ErpCredentialData): VaultPayload {
  return encryptCredential(JSON.stringify(data));
}

/**
 * Convenience: decrypt and parse a typed credential object.
 */
export function decryptErpCredential(payload: VaultPayload): ErpCredentialData {
  return JSON.parse(decryptCredential(payload)) as ErpCredentialData;
}
