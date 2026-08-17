import { createHash } from 'crypto';

/**
 * Canonically orders JSON object keys for stable hashing.
 *
 * @param {unknown} value JSON-compatible value.
 * @returns {unknown} Canonically ordered value.
 */
export function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJson(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalizeJson(item)])
    );
  }

  return value;
}

/**
 * Computes a reproducible SHA-256 hash for a JSON-compatible value.
 *
 * @param {unknown} value Value to hash.
 * @returns {string} Lowercase hexadecimal SHA-256 digest.
 */
export function hashCanonicalJson(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalizeJson(value))).digest('hex');
}
