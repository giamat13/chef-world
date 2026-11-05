// The storage interface the tools use, plus the per-request resolver. Two implementations:
// restStore (Firestore as the signed-in user) and an in-memory mock for tests (CHEF_MOCK=1, key "mock").
import { UpstreamError } from "./http.js";
import type { PersonalFields, Pub, Recipe } from "./recipes.js";
import { restStore } from "./firestore.js";
import { currentKey, sessionFromRefreshToken } from "./session.js";

export interface Store {
  uid: string;
  provider: string;
  email: string;
  listRecipes(): Promise<Recipe[]>;
  getRecipe(id: string): Promise<{ recipe: Recipe; updateTime: string } | null>;
  /** Replaces the whole document (like the site's setDoc). With updateTime, fails if the doc changed since it was read. */
  putRecipe(recipe: Recipe, updateTime?: string): Promise<void>;
  deleteRecipe(id: string): Promise<void>;
  /** Changes only the given personal fields (the site's merge write). The recipe must exist. */
  updateFields(id: string, fields: PersonalFields): Promise<void>;
  listPublic(): Promise<Pub[]>;
  listMyPublic(): Promise<Pub[]>;
  getPublic(pubId: string): Promise<Pub | null>;
  putPublic(pub: Pub): Promise<void>;
  deletePublic(pubId: string): Promise<void>;
}

const MOCK = process.env.CHEF_MOCK === "1";
const KEY_RE = /^[A-Za-z0-9_.-]{40,600}$/;

/** The store for the link of the current request. Throws a readable error when there is no valid link. */
export async function currentStore(): Promise<Store> {
  const key = currentKey();
  if (MOCK && key === "mock") return mockStore();
  if (!KEY_RE.test(key))
    throw new UpstreamError(
      "This connector needs your personal Claude link. In Chef World, sign in, click 'Connect Claude', and paste that link into claude.ai.",
      "auth",
    );
  const apiKey = process.env.FIREBASE_API_KEY ?? "";
  if (!apiKey) throw new UpstreamError("FIREBASE_API_KEY is not set on the server.", "config");
  try {
    return restStore(await sessionFromRefreshToken(key, apiKey));
  } catch (e) {
    throw new UpstreamError(e instanceof Error ? e.message : String(e), "auth");
  }
}

// ---- in-memory store for tests and local development ----
let mock: Store | undefined;

export function mockStore(): Store {
  if (mock) return mock;
  const uid = "mock-user-0001";
  const email = "tester@example.com";
  const recipes = new Map<string, Recipe>();
  const times = new Map<string, string>();
  const pubs = new Map<string, Pub>();
  const stamp = () => new Date().toISOString();
  mock = {
    uid,
    provider: "password",
    email,
    async listRecipes() {
      return [...recipes.values()].filter((r) => !r.deletedAt).map((r) => structuredClone(r));
    },
    async getRecipe(id) {
      const r = recipes.get(id);
      return r && !r.deletedAt ? { recipe: structuredClone(r), updateTime: times.get(id) ?? "" } : null;
    },
    async putRecipe(recipe, updateTime) {
      if (updateTime && times.get(recipe.id) !== updateTime)
        throw new UpstreamError("This recipe changed while it was being edited. Read it again and retry the update.", "mock");
      recipes.set(recipe.id, structuredClone(recipe));
      times.set(recipe.id, stamp());
    },
    async deleteRecipe(id) {
      recipes.delete(id);
      times.delete(id);
    },
    async updateFields(id, fields) {
      const r = recipes.get(id);
      if (!r) throw new UpstreamError("No recipe with this id in your account.", "mock");
      recipes.set(id, { ...r, ...fields });
      times.set(id, stamp());
    },
    async listPublic() {
      return [...pubs.values()].map((p) => structuredClone(p));
    },
    async listMyPublic() {
      return [...pubs.values()].filter((p) => p.ownerId === uid).map((p) => structuredClone(p));
    },
    async getPublic(pubId) {
      const p = pubs.get(pubId);
      return p ? structuredClone(p) : null;
    },
    async putPublic(pub) {
      pubs.set(pub.pubId, structuredClone(pub));
    },
    async deletePublic(pubId) {
      pubs.delete(pubId);
    },
  };
  return mock;
}
