// Firestore REST client that runs as the signed-in user (ID token from session.ts).
// Writes use the same document shapes as the site, so firestore.rules decide what is allowed.
import { UpstreamError } from "./http.js";
import type { PersonalFields, Recipe, Pub } from "./recipes.js";
import type { Session } from "./session.js";
import type { Store } from "./store.js";

// ---- Firestore value codec (JS value <-> REST "Value" object) ----
export function encode(v: unknown): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: v.length ? { values: v.map(encode) } : {} };
  if (typeof v === "object") return { mapValue: { fields: fieldsOf(v) } };
  return { stringValue: String(v) };
}

export function decode(v: any): unknown {
  if (!v || typeof v !== "object") return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(decode);
  if ("mapValue" in v) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries<any>(v.mapValue.fields ?? {})) out[k] = decode(x);
    return out;
  }
  return null; // nullValue and anything unknown
}

/** Object -> Firestore `fields` map. Undefined keys are skipped (Firestore rejects them). */
function fieldsOf(obj: object): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [k, x] of Object.entries(obj)) if (x !== undefined) fields[k] = encode(x);
  return fields;
}

// ---- REST plumbing ----
const projectId = (): string => {
  const p = process.env.FIREBASE_PROJECT_ID;
  if (!p) throw new UpstreamError("FIREBASE_PROJECT_ID is not set on the server.", "config");
  return p;
};
const DOCS = () => `projects/${projectId()}/databases/(default)/documents`;
const API = () => `https://firestore.googleapis.com/v1/${DOCS()}`;

async function call(session: Session, method: "GET" | "POST", path: string, body?: unknown): Promise<{ status: number; json: any }> {
  let res: Response;
  try {
    res = await fetch(`${API()}${path}`, {
      method,
      headers: { authorization: `Bearer ${session.idToken}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    throw new UpstreamError(`Firestore is unreachable (${e instanceof Error ? e.message : String(e)}).`, "firestore");
  }
  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function check(status: number, json: any): void {
  if (status >= 200 && status < 300) return;
  const msg: string = json?.error?.message ?? "";
  const st: string = json?.error?.status ?? "";
  if (status === 401 || st === "UNAUTHENTICATED")
    throw new UpstreamError("Your Claude link has expired. Create a new Claude link in Chef World.", "firestore", status);
  if (status === 403 || st === "PERMISSION_DENIED")
    throw new UpstreamError("Firestore denied this request (firestore.rules). Check that the link belongs to a signed-in Chef World account.", "firestore", status);
  if (st === "FAILED_PRECONDITION" || st === "ABORTED" || status === 409)
    throw new UpstreamError("This recipe changed while it was being edited. Read it again and retry the update.", "firestore", status);
  if (status === 429) throw new UpstreamError("Firestore rate limit reached. Wait a minute and try again.", "firestore", status);
  throw new UpstreamError(`Firestore error ${status}${st ? ` (${st})` : ""}${msg ? `: ${msg}` : ""}`, "firestore", status);
}

function fromDoc(doc: any): { id: string; data: any; updateTime: string } {
  return {
    id: String(doc.name ?? "").split("/").pop() ?? "",
    data: decode({ mapValue: { fields: doc.fields ?? {} } }),
    updateTime: String(doc.updateTime ?? ""),
  };
}

async function listAll(session: Session, path: string): Promise<any[]> {
  const out: any[] = [];
  let token = "";
  for (let page = 0; page < 20; page++) {
    const q = `?pageSize=300${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`;
    const { status, json } = await call(session, "GET", `/${path}${q}`);
    if (status === 404) return out;
    check(status, json);
    out.push(...(json.documents ?? []));
    token = json.nextPageToken ?? "";
    if (!token) break;
  }
  return out;
}

async function docsOwnedBy(session: Session, collectionId: string, ownerId: string): Promise<any[]> {
  const body = {
    structuredQuery: {
      from: [{ collectionId }],
      where: { fieldFilter: { field: { fieldPath: "ownerId" }, op: "EQUAL", value: { stringValue: ownerId } } },
      limit: 500,
    },
  };
  const { status, json } = await call(session, "POST", ":runQuery", body);
  check(status, json);
  return (Array.isArray(json) ? json : []).map((row: any) => row.document).filter(Boolean);
}

async function commit(session: Session, write: unknown): Promise<void> {
  const { status, json } = await call(session, "POST", ":commit", { writes: [write] });
  check(status, json);
}

/** The Store used for a real signed-in user. */
export function restStore(session: Session): Store {
  const uid = session.uid;
  const recipesPath = `users/${uid}/recipes`;
  return {
    uid,
    provider: session.provider,
    email: session.email,

    async listRecipes(): Promise<Recipe[]> {
      return (await listAll(session, recipesPath)).map((d) => fromDoc(d).data as Recipe);
    },

    async getRecipe(id) {
      const { status, json } = await call(session, "GET", `/${recipesPath}/${id}`);
      if (status === 404) return null;
      check(status, json);
      const f = fromDoc(json);
      return { recipe: f.data as Recipe, updateTime: f.updateTime };
    },

    async putRecipe(recipe, updateTime) {
      await commit(session, {
        update: { name: `${DOCS()}/${recipesPath}/${recipe.id}`, fields: fieldsOf(recipe) },
        ...(updateTime ? { currentDocument: { updateTime } } : {}),
      });
    },

    async deleteRecipe(id) {
      await commit(session, { delete: `${DOCS()}/${recipesPath}/${id}` });
    },

    async updateFields(id, fields) {
      // Only the listed fields change, like the site's merge write. A field in the mask that is missing
      // from the body would be deleted, so undefined values are left out of both.
      const set = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
      await commit(session, {
        update: { name: `${DOCS()}/${recipesPath}/${id}`, fields: fieldsOf(set) },
        updateMask: { fieldPaths: Object.keys(set) },
        currentDocument: { exists: true },
      });
    },

    async listPublic(): Promise<Pub[]> {
      return (await listAll(session, "publicRecipes")).map((d) => fromDoc(d).data as Pub);
    },

    async listMyPublic(): Promise<Pub[]> {
      return (await docsOwnedBy(session, "publicRecipes", uid)).map((d) => fromDoc(d).data as Pub);
    },

    async getPublic(pubId) {
      const { status, json } = await call(session, "GET", `/publicRecipes/${pubId}`);
      if (status === 404) return null;
      check(status, json);
      return fromDoc(json).data as Pub;
    },

    async putPublic(pub) {
      await commit(session, { update: { name: `${DOCS()}/publicRecipes/${pub.pubId}`, fields: fieldsOf(pub) } });
    },

    async deletePublic(pubId) {
      await commit(session, { delete: `${DOCS()}/publicRecipes/${pubId}` });
    },
  };
}
