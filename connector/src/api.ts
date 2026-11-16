// General REST API (JSON) for Chef World, next to the MCP connector. Same personal key as the Claude link:
//   Authorization: Bearer <key>     (or ?key=<key>)
// Every call runs as the signed-in user against Firestore, so firestore.rules stay the security boundary.
import { UpstreamError } from "./lib/http.js";
import {
  DIFFICULTIES,
  LANGUAGES,
  VISIBILITY,
  assertPublishable,
  buildRecipe,
  createdAtOf,
  maskEmail,
  newRecipeId,
  recipeTags,
  sanitizeImported,
  summarize,
  withoutPersonalFields,
  type Pub,
  type Recipe,
  type RecipeInput,
} from "./lib/recipes.js";
import { currentStore } from "./lib/store.js";
import { withKey } from "./lib/session.js";
import { UNIT_SYSTEMS, withUnits } from "./lib/units.js";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
  "access-control-max-age": "86400",
};
const MAX_BODY = 512 * 1024;
const BASE = "/api/v1";

class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...CORS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const shareLink = (pubId: string): string | null => {
  const base = process.env.SITE_URL;
  return base ? `${base}${base.includes("?") ? "&" : "?"}r=${encodeURIComponent(pubId)}` : null;
};
const contains = (hay: string, q: string) => hay.toLowerCase().includes(q.toLowerCase());
const ingText = (i: Recipe["ingredients"][number]) => ("section" in i ? i.section : i.text);
const flag = (v: string | null) => v === "1" || v === "true";
const intParam = (v: string | null, def: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : def;
};

function keyOf(request: Request, url: URL): string {
  const h = request.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return (m ? m[1] : url.searchParams.get("key") ?? "").trim();
}

async function bodyOf(request: Request): Promise<Record<string, any>> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) throw new HttpError(413, "Payload too large (max 512 KB).");
  const text = await request.text();
  if (text.length > MAX_BODY) throw new HttpError(413, "Payload too large (max 512 KB).");
  if (!text.trim()) return {};
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error();
    return v;
  } catch {
    throw new HttpError(400, "The body must be a JSON object.");
  }
}

const str = (v: unknown, max: number, field: string): string | undefined => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string" && typeof v !== "number") throw new HttpError(400, `"${field}" must be text.`);
  const s = String(v).trim();
  if (s.length > max) throw new HttpError(400, `"${field}" is too long (max ${max}).`);
  return s;
};

/** Converts a JSON body into RecipeInput. Accepts steps with `minutes` or `seconds` (the export format). */
function toInput(b: Record<string, any>): RecipeInput {
  const input: RecipeInput = {};
  const set = <K extends keyof RecipeInput>(k: K, v: RecipeInput[K] | undefined) => {
    if (v !== undefined) input[k] = v;
  };
  set("name", str(b.name, 200, "name"));
  set("emoji", str(b.emoji, 8, "emoji"));
  set("prepTime", str(b.prepTime ?? b.time, 10, "prepTime"));
  set("cookTime", str(b.cookTime, 10, "cookTime"));
  set("servings", str(b.servings, 20, "servings"));
  set("servingsUnit", str(b.servingsUnit, 40, "servingsUnit"));
  set("notes", str(b.notes, 2000, "notes"));
  set("sourceUrl", str(b.sourceUrl, 500, "sourceUrl"));
  const diff = str(b.difficulty, 10, "difficulty");
  if (diff !== undefined) {
    if (diff && !(DIFFICULTIES as readonly string[]).includes(diff)) throw new HttpError(400, `"difficulty" must be one of: ${DIFFICULTIES.join(", ")} (or empty).`);
    input.difficulty = diff;
  }
  if (b.tags !== undefined) {
    const raw = Array.isArray(b.tags) ? b.tags : typeof b.tags === "string" ? b.tags.split(",") : null;
    if (!raw || raw.length > 20) throw new HttpError(400, '"tags" must be a list of up to 20 texts.');
    input.tags = raw.map((t: unknown) => String(t).trim().slice(0, 40)).filter(Boolean);
  }
  if (b.ingredients !== undefined) {
    if (!Array.isArray(b.ingredients) || b.ingredients.length > 200) throw new HttpError(400, '"ingredients" must be a list of up to 200 items.');
    input.ingredients = b.ingredients.map((i: any) => {
      if (typeof i === "string") return { name: i.trim().slice(0, 200) };
      if (!i || typeof i !== "object") throw new HttpError(400, "Each ingredient must be an object or a text.");
      return {
        section: i.section != null ? String(i.section).slice(0, 100) : undefined,
        quantity: i.quantity != null ? String(i.quantity).slice(0, 30) : undefined,
        unit: i.unit != null ? String(i.unit).slice(0, 30) : undefined,
        name: i.name != null ? String(i.name).slice(0, 200) : i.text != null ? String(i.text).slice(0, 200) : undefined,
      };
    });
  }
  if (b.steps !== undefined) {
    if (!Array.isArray(b.steps) || b.steps.length > 200) throw new HttpError(400, '"steps" must be a list of up to 200 items.');
    input.steps = b.steps.map((s: any) => {
      if (typeof s === "string") return { text: s.slice(0, 1000) };
      if (!s || typeof s !== "object" || typeof s.text !== "string") throw new HttpError(400, 'Each step needs a "text".');
      const minutes = s.minutes != null ? Number(s.minutes) : s.seconds != null ? Number(s.seconds) / 60 : null;
      return { text: s.text.slice(0, 1000), minutes: minutes !== null && Number.isFinite(minutes) && minutes > 0 ? Math.min(minutes, 1440) : null };
    });
  }
  return input;
}

function publicView(p: Pub) {
  return { ...p, shareLink: shareLink(p.pubId) };
}

async function route(request: Request, url: URL, segs: string[]): Promise<Response> {
  const method = request.method;
  const s = await currentStore();
  const [a, b, c] = segs;

  // ---- who am I ----
  if (a === "me" && method === "GET") return json({ uid: s.uid, email: s.email, provider: s.provider });

  // ---- my recipes ----
  if (a === "recipes") {
    if (!b) {
      if (method === "GET") {
        const q = url.searchParams.get("q");
        const tag = url.searchParams.get("tag");
        let list = await s.listRecipes();
        if (q) list = list.filter((r) => contains([r.name, recipeTags(r).join(" "), r.ingredients.map(ingText).join(" "), r.notes].join(" "), q));
        if (tag) list = list.filter((r) => recipeTags(r).some((t) => t.toLowerCase() === tag.toLowerCase()));
        if (flag(url.searchParams.get("favorite"))) list = list.filter((r) => r.favorite);
        const sort = url.searchParams.get("sort") ?? "added";
        const prep = (r: Recipe) => {
          const v = parseFloat(r.prepTime ?? r.time);
          return Number.isFinite(v) ? v : Infinity;
        };
        if (sort === "name") list.sort((x, y) => x.name.localeCompare(y.name));
        else if (sort === "prep") list.sort((x, y) => (prep(x) === prep(y) ? 0 : prep(x) < prep(y) ? -1 : 1));
        else if (sort === "cooked") list.sort((x, y) => (y.lastCookedAt ?? 0) - (x.lastCookedAt ?? 0) || createdAtOf(y) - createdAtOf(x));
        else list.sort((x, y) => createdAtOf(y) - createdAtOf(x));
        const total = list.length;
        const limit = intParam(url.searchParams.get("limit"), 100, 500);
        const full = flag(url.searchParams.get("full"));
        const out = list.slice(0, limit).map((r) => (full ? r : { ...summarize(r), favorite: !!r.favorite, lastCookedAt: r.lastCookedAt ?? null }));
        return json({ total, count: out.length, recipes: out });
      }
      if (method === "POST") {
        const input = toInput(await bodyOf(request));
        if (!input.name) throw new HttpError(400, 'A recipe needs a "name".');
        if (!input.steps?.length) throw new HttpError(400, 'A recipe needs at least one step in "steps".');
        const recipe = buildRecipe(newRecipeId(), input);
        await s.putRecipe(recipe);
        return json(recipe, 201);
      }
      throw new HttpError(405, "Use GET or POST.");
    }

    const id = decodeURIComponent(b);
    if (!c) {
      const got = await s.getRecipe(id);
      if (method === "GET") {
        if (!got) throw new HttpError(404, `No recipe with id "${id}" in your account.`);
        const units = url.searchParams.get("units") ?? "original";
        if (!(UNIT_SYSTEMS as readonly string[]).includes(units)) throw new HttpError(400, `"units" must be one of: ${UNIT_SYSTEMS.join(", ")}.`);
        const pub = await s.getPublic(`${s.uid}_${id}`);
        return json({
          ...withUnits(got.recipe, units as (typeof UNIT_SYSTEMS)[number]),
          published: pub ? { language: pub.language, visibility: pub.visibility, pubId: pub.pubId, shareLink: shareLink(pub.pubId) } : null,
        });
      }
      if (method === "PUT" || method === "PATCH") {
        if (!got) throw new HttpError(404, `No recipe with id "${id}" in your account.`);
        const input = toInput(await bodyOf(request));
        if (input.steps && !input.steps.length) throw new HttpError(400, "A recipe needs at least one step.");
        const next = buildRecipe(got.recipe.id, input, got.recipe);
        if (!next.name) throw new HttpError(400, 'A recipe needs a "name".');
        await s.putRecipe(next, got.updateTime);
        return json(next);
      }
      if (method === "DELETE") {
        if (!got) throw new HttpError(404, `No recipe with id "${id}" in your account.`);
        await s.deleteRecipe(id);
        const pub = await s.getPublic(`${s.uid}_${id}`);
        return json({ deleted: id, stillPublished: !!pub, note: pub ? "The published copy is still live; DELETE its /publish to remove it." : undefined });
      }
      throw new HttpError(405, "Use GET, PUT, PATCH or DELETE.");
    }

    if (c === "favorite" && (method === "POST" || method === "PUT")) {
      const got = await s.getRecipe(id);
      if (!got) throw new HttpError(404, `No recipe with id "${id}" in your account.`);
      const body = await bodyOf(request);
      const favorite = body.favorite === undefined ? true : body.favorite === true;
      await s.updateFields(id, { favorite });
      return json({ id, favorite });
    }
    if (c === "cooked" && method === "POST") {
      const got = await s.getRecipe(id);
      if (!got) throw new HttpError(404, `No recipe with id "${id}" in your account.`);
      const now = Date.now();
      await s.updateFields(id, { lastCookedAt: now });
      return json({ id, lastCookedAt: now });
    }
    if (c === "publish") {
      if (method === "POST" || method === "PUT") {
        const got = await s.getRecipe(id);
        if (!got) throw new HttpError(404, `No recipe with id "${id}" in your account.`);
        assertPublishable(got.recipe);
        const body = await bodyOf(request);
        const existing = await s.getPublic(`${s.uid}_${id}`);
        const language = str(body.language, 20, "language") ?? existing?.language ?? "English";
        const visibility = str(body.visibility, 10, "visibility") ?? existing?.visibility ?? "public";
        if (!(LANGUAGES as readonly string[]).includes(language)) throw new HttpError(400, `"language" must be one of: ${LANGUAGES.join(", ")}.`);
        if (!(VISIBILITY as readonly string[]).includes(visibility)) throw new HttpError(400, `"visibility" must be one of: ${VISIBILITY.join(", ")}.`);
        const pub: Pub = {
          ...withoutPersonalFields(got.recipe),
          pubId: `${s.uid}_${id}`,
          sourceId: id,
          ownerId: s.uid,
          ownerLabel: s.provider === "anonymous" ? "Guest" : maskEmail(s.email),
          language,
          visibility,
          publishedAt: Date.now(),
        };
        await s.putPublic(pub);
        return json(publicView(pub));
      }
      if (method === "DELETE") {
        const pub = await s.getPublic(`${s.uid}_${id}`);
        if (!pub) return json({ id, published: false, changed: false });
        await s.deletePublic(pub.pubId);
        return json({ id, published: false, changed: true });
      }
      throw new HttpError(405, "Use POST/PUT to publish or DELETE to unpublish.");
    }
    throw new HttpError(404, "Unknown recipes route.");
  }

  // ---- community ----
  if (a === "community") {
    if (!b && method === "GET") {
      const q = url.searchParams.get("q");
      const tag = url.searchParams.get("tag");
      const language = url.searchParams.get("language");
      let list = (await s.listPublic()).filter((p) => p.visibility !== "unlisted");
      if (q) list = list.filter((p) => contains([p.name, recipeTags(p).join(" "), p.ingredients.map(ingText).join(" ")].join(" "), q));
      if (tag) list = list.filter((p) => recipeTags(p).some((t) => t.toLowerCase() === tag.toLowerCase()));
      if (language) list = list.filter((p) => p.language === language);
      list.sort((x, y) => (y.publishedAt ?? 0) - (x.publishedAt ?? 0));
      const limit = intParam(url.searchParams.get("limit"), 50, 200);
      const full = flag(url.searchParams.get("full"));
      const out = list.slice(0, limit).map((p) =>
        full
          ? publicView(p)
          : { pubId: p.pubId, ...summarize(p), ownerLabel: p.ownerLabel, language: p.language, publishedAt: p.publishedAt, shareLink: shareLink(p.pubId) },
      );
      return json({ total: list.length, count: out.length, recipes: out });
    }
    if (b) {
      const raw = decodeURIComponent(b);
      const m = raw.match(/[?&]r=([^&#]+)/);
      const pubId = (m ? decodeURIComponent(m[1]) : raw).trim();
      if (!c && method === "GET") {
        const p = await s.getPublic(pubId);
        if (!p) throw new HttpError(404, "This recipe is no longer published, or the id is wrong.");
        const units = url.searchParams.get("units") ?? "original";
        if (!(UNIT_SYSTEMS as readonly string[]).includes(units)) throw new HttpError(400, `"units" must be one of: ${UNIT_SYSTEMS.join(", ")}.`);
        return json({ ...withUnits(p, units as (typeof UNIT_SYSTEMS)[number]), pubId: p.pubId, ownerLabel: p.ownerLabel, language: p.language, visibility: p.visibility, shareLink: shareLink(p.pubId) });
      }
      if (c === "save" && method === "POST") {
        const p = await s.getPublic(pubId);
        if (!p) throw new HttpError(404, "This recipe is no longer published, or the id is wrong.");
        const copy = buildRecipe(newRecipeId(), {
          emoji: p.emoji,
          name: p.name,
          prepTime: p.prepTime,
          cookTime: p.cookTime,
          servings: p.servings,
          servingsUnit: p.servingsUnit,
          tags: recipeTags(p),
          difficulty: p.difficulty,
          notes: p.notes,
          sourceUrl: p.sourceUrl,
        });
        copy.ingredients = p.ingredients;
        copy.steps = p.steps;
        await s.putRecipe(copy);
        return json(copy, 201);
      }
    }
    throw new HttpError(404, "Unknown community route.");
  }

  // ---- backup ----
  if (a === "export" && method === "GET") {
    const recipes = await s.listRecipes();
    return json({ app: "chef-world", version: 1, exportedAt: new Date().toISOString(), recipes });
  }
  if (a === "import" && method === "POST") {
    const body = await bodyOf(request);
    const list = Array.isArray(body.recipes) ? body.recipes : null;
    if (!list || !list.length) throw new HttpError(400, 'Send {"recipes": [...]} with at least one recipe.');
    if (list.length > 100) throw new HttpError(400, "Up to 100 recipes per call.");
    const valid = list.map((r: unknown) => sanitizeImported(r)).filter((r: Recipe | null): r is Recipe => r !== null);
    if (!valid.length) throw new HttpError(400, "No valid recipes: each one needs a name and at least one step.");
    for (const r of valid) await s.putRecipe(r);
    return json({ imported: valid.length, skipped: list.length - valid.length, ids: valid.map((r: Recipe) => r.id) }, 201);
  }

  throw new HttpError(404, `Unknown route. See GET ${BASE}.`);
}

const INDEX = {
  name: "Chef World API",
  version: 1,
  auth: "Send your personal key as 'Authorization: Bearer <key>' (or ?key=<key>). Create your own key in Chef World: Connect Claude, section 'API for anything else' (keys start with cw_ and can be revoked there).",
  routes: [
    "GET    /api/v1/me",
    "GET    /api/v1/recipes?q=&tag=&favorite=1&sort=added|name|prep|cooked&limit=&full=1",
    "POST   /api/v1/recipes                       {name, steps[], ingredients[], tags[], prepTime, cookTime, servings, servingsUnit, difficulty, notes, sourceUrl, emoji}",
    "GET    /api/v1/recipes/:id?units=original|metric|us",
    "PUT    /api/v1/recipes/:id                   (only the fields you send change)",
    "DELETE /api/v1/recipes/:id",
    "POST   /api/v1/recipes/:id/favorite          {favorite: true|false}",
    "POST   /api/v1/recipes/:id/cooked",
    "POST   /api/v1/recipes/:id/publish           {language, visibility: public|unlisted}",
    "DELETE /api/v1/recipes/:id/publish",
    "GET    /api/v1/community?q=&tag=&language=&limit=&full=1",
    "GET    /api/v1/community/:pubId?units=",
    "POST   /api/v1/community/:pubId/save",
    "GET    /api/v1/export",
    "POST   /api/v1/import                        {recipes: [...]} (up to 100)",
  ],
  ingredient: "{quantity, unit, name} or {section} or a plain text",
  step: "{text, minutes} or a plain text",
};

/** Entry for /api/* requests. Never throws: every failure is a JSON error with a status code. */
export async function handleApi(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  if (path === "/api" || path === BASE) return json(INDEX);
  if (!path.startsWith(BASE + "/")) return json({ error: `Unknown route. See GET ${BASE}.` }, 404);
  const segs = path.slice(BASE.length + 1).split("/");
  try {
    return await withKey(keyOf(request, url), () => route(request, url, segs));
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    if (e instanceof UpstreamError) return json({ error: e.message }, e.source === "auth" ? 401 : e.status && e.status >= 400 && e.status < 600 ? e.status : 502);
    return json({ error: `Unexpected error: ${e instanceof Error ? e.message : String(e)}` }, 500);
  }
}
