/**
 * Session sharing utilities — frontend-first share link generation.
 *
 * Uses a simple base64 encoding of the session ID. Backend can replace with
 * proper short links later.
 */
import type { SessionMetadata } from "./session-types";
import { useSessionMetadataStore } from "./session-metadata-store";

export function generateShareLink(sessionId: string): string {
  const store = useSessionMetadataStore.getState();
  return store.generateShareLink(sessionId);
}

export function getSharedSession(link: string): SessionMetadata | undefined {
  const parsed = parseShareLink(link);
  if (!parsed) return undefined;
  return useSessionMetadataStore.getState().getSessionMetadata(parsed.sid);
}

export type ParsedShareLink = {
  sid: string;
  ts: number;
};

/**
 * Parse a openwork://session/<base64> share link back into its sessionId.
 * Returns null for malformed links.
 */
export function parseShareLink(link: string): ParsedShareLink | null {
  try {
    const url = new URL(link);
    if (url.protocol !== "openwork:" || url.host !== "session") return null;
    const encoded = url.pathname.replace(/^\//, "");
    const json = typeof window !== "undefined"
      ? atob(encoded)
      : Buffer.from(encoded, "base64").toString("utf-8");
    const parsed = JSON.parse(json) as { v?: number; sid?: string; ts?: number };
    if (typeof parsed.sid !== "string" || !parsed.sid) return null;
    return { sid: parsed.sid, ts: typeof parsed.ts === "number" ? parsed.ts : 0 };
  } catch {
    return null;
  }
}

/** Copy a share link to the clipboard using the Async Clipboard API. */
export async function copyShareLink(sessionId: string): Promise<string> {
  const link = generateShareLink(sessionId);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(link);
  }
  return link;
}
