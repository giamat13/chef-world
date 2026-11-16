// Personal API keys ("cw_..."), created in the site and revocable there.
// Firestore holds apiKeys/{sha256("id:"+key)} with the user's refresh token encrypted by AES-GCM under a key
// derived from sha256("enc:"+key). Only someone holding the key can decrypt it, so the database alone is useless.
import { UpstreamError } from "./http.js";

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha = (s: string) => crypto.subtle.digest("SHA-256", enc.encode(s));

function fromB64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

export const isApiKey = (k: string) => /^cw_[A-Za-z0-9_-]{43}$/.test(k);

const cache = new Map<string, { token: string; at: number }>();

/** Turns an API key into the owner's refresh token. Throws a readable error for unknown or revoked keys. */
export async function refreshTokenFromApiKey(key: string): Promise<string> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.token;
  const project = process.env.FIREBASE_PROJECT_ID;
  if (!project) throw new UpstreamError("FIREBASE_PROJECT_ID is not set on the server.", "config");
  const id = hex(await sha("id:" + key));
  let res: Response;
  try {
    res = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/apiKeys/${id}`, {
      signal: AbortSignal.timeout(12000),
    });
  } catch (e) {
    throw new UpstreamError(`Firestore is unreachable (${e instanceof Error ? e.message : String(e)}).`, "auth");
  }
  const bad = () => new UpstreamError("This API key is not valid or was revoked. Create a new key in Chef World.", "auth");
  if (!res.ok) throw bad();
  const doc: any = await res.json().catch(() => ({}));
  const blob: string | undefined = doc?.fields?.blob?.stringValue;
  if (!blob) throw bad();
  try {
    const raw = fromB64url(blob);
    const aes = await crypto.subtle.importKey("raw", await sha("enc:" + key), "AES-GCM", false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, aes, raw.slice(12));
    const token = new TextDecoder().decode(plain);
    if (cache.size > 200) cache.clear();
    cache.set(key, { token, at: Date.now() });
    return token;
  } catch {
    throw bad();
  }
}
