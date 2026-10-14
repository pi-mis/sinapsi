/**
 * Deterministic note ids for imported items (same chat session, event or person
 * → same id), so importing the same file twice never creates duplicates.
 * Format: a UUID v5-style string from SHA-1 of user id + key.
 */
export async function stableId(userId: string, key: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-1", new TextEncoder().encode(`sinapsi:${userId}:${key}`)),
  ).slice(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
