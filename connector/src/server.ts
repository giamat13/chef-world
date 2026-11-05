import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { UpstreamError } from "./lib/http.js";
import { communityItem, dayOf, listPage, recipeItem, recipePage, type Page } from "./lib/cards.js";
import {
  LANGUAGES,
  VISIBILITY,
  assertPublishable,
  buildRecipe,
  createdAtOf,
  maskEmail,
  newRecipeId,
  recipeTags,
  recipeText,
  sanitizeImported,
  withoutPersonalFields,
  type Pub,
  type Recipe,
  type RecipeInput,
} from "./lib/recipes.js";
import { currentStore } from "./lib/store.js";
import { UNIT_SYSTEMS, withUnits } from "./lib/units.js";
import { VIEW_CSP, VIEW_HTML, VIEW_MIME, VIEW_URI } from "./view.js";

const READ = { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: true } as const;
const WRITE = { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: true } as const;
const REPLACE = { readOnlyHint: false, idempotentHint: true, destructiveHint: false, openWorldHint: true } as const;
const DESTROY = { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: true } as const;
const UI_META = { ui: { resourceUri: VIEW_URI }, "ui/resourceUri": VIEW_URI };

type Out = { content: { type: "text"; text: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean };
const text = (t: string): Out => ({ content: [{ type: "text", text: t }] });
// Text for the model, plus structured data for the inline card.
const card = (t: string, data: Page): Out => ({ content: [{ type: "text", text: t }], structuredContent: data as unknown as Record<string, unknown> });
const fail = (t: string): Out => ({ content: [{ type: "text", text: t }], isError: true });

/** Readable failures become tool errors, never crashes. */
function safe<A>(fn: (a: A) => Promise<Out>) {
  return async (a: A): Promise<Out> => {
    try {
      return await fn(a);
    } catch (e) {
      if (e instanceof UpstreamError) return fail(`⚠️ ${e.message}`);
      return fail(`⚠️ Unexpected error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
}

const shareLink = (pubId: string): string | null => {
  const base = process.env.SITE_URL;
  return base ? `${base}${base.includes("?") ? "&" : "?"}r=${encodeURIComponent(pubId)}` : null;
};

/** Accepts a community id ("<uid>_<recipeId>") or a full share link (...?r=<id>). */
function parsePubId(input: string): string {
  const m = input.match(/[?&]r=([^&#]+)/);
  return (m ? decodeURIComponent(m[1]) : input).trim();
}

const contains = (hay: string, q: string) => hay.toLowerCase().includes(q.toLowerCase());

// ---- shared input schemas (mirror the site's recipe form) ----
const idSchema = z.string().trim().min(1).max(200).describe("Recipe id from list_my_recipes, e.g. 'r_lx3k9ab12cd'.");
const pubIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(600)
  .describe("Community id '<userId>_<recipeId>', or the full share link from Chef World (https://.../?r=...).");
const limitSchema = z.number().int().min(1).max(200).default(50).describe("Maximum number of results. Default 50.");
const confirmSchema = (what: string) =>
  z.literal(true).describe(`Must be true. Set it only after the user explicitly approved ${what} in this chat.`);

const ingredientSchema = z.union([
  z.object({ section: z.string().trim().min(1).max(120) }).describe("A section header, e.g. { section: 'For the sauce' }."),
  z.object({
    quantity: z.string().trim().max(40).optional().describe("Amount as text, e.g. '200' or '1/2'."),
    unit: z.string().trim().max(40).optional().describe("Unit, e.g. 'g', 'cup', 'tbsp'. Leave empty for 'eggs'."),
    name: z.string().trim().min(1).max(200).describe("Ingredient name, e.g. 'flour'."),
  }),
]);
const stepSchema = z.object({
  text: z.string().trim().min(1).max(1000).describe("What to do, e.g. 'Whisk the eggs until frothy'."),
  minutes: z.number().min(0).max(1440).nullable().optional().describe("Waiting time in minutes that gets a timer, or null."),
});
const fieldShape = {
  emoji: z.string().trim().max(8).optional().describe("One food emoji, e.g. '🍝'. Default '🍽️'."),
  prepTime: z.string().trim().max(10).optional().describe("Prep time in minutes as text, e.g. '15'."),
  cookTime: z.string().trim().max(10).optional().describe("Cook time in minutes as text, e.g. '30'."),
  servings: z.string().trim().max(20).optional().describe("Number of servings as text, e.g. '4'."),
  servingsUnit: z.string().trim().max(40).optional().describe("What the servings count, e.g. 'servings' or 'cookies'. Default 'servings'."),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional().describe("Categories, e.g. ['Vegetarian', 'Dinner', 'Italian']."),
  difficulty: z.enum(["", "Easy", "Medium", "Hard"]).optional().describe("Easy, Medium, Hard, or '' for none."),
  notes: z.string().max(2000).optional().describe("Tips or notes, e.g. 'Rest the dough overnight.'"),
  ingredients: z.array(ingredientSchema).max(200).optional().describe("The full ingredient list. Replaces the old list when updating."),
  steps: z.array(stepSchema).max(200).optional().describe("The full step list. Replaces the old steps when updating; at least one step is required."),
};
const createShape = {
  name: z.string().trim().min(1).max(200).describe("Recipe name, e.g. 'Pancakes'."),
  ...fieldShape,
};
const updateShape = {
  id: idSchema,
  name: z.string().trim().min(1).max(200).optional().describe("New recipe name."),
  ...fieldShape,
};

const SORTS = ["added", "name", "prep", "cooked"] as const;
const sortSchema = z
  .enum(SORTS)
  .default("added")
  .describe("Order: 'added' newest first (default, as on the site), 'name' A-Z, 'prep' shortest prep first, 'cooked' recently cooked first.");
const unitsSchema = z
  .enum(UNIT_SYSTEMS)
  .default("original")
  .describe("Ingredient units to show: 'original' as saved, 'metric' (g, ml) or 'us' (oz, cups). Display only; the saved recipe is not changed.");

/** Same orders as the site's sort menu. */
function sortRecipes(list: Recipe[], mode: (typeof SORTS)[number]): Recipe[] {
  const prep = (r: Recipe) => {
    const v = parseFloat(r.prepTime ?? r.time);
    return Number.isFinite(v) ? v : Infinity;
  };
  const arr = list.slice();
  if (mode === "name") arr.sort((a, b) => a.name.localeCompare(b.name));
  else if (mode === "prep") arr.sort((a, b) => (prep(a) === prep(b) ? 0 : prep(a) < prep(b) ? -1 : 1));
  else if (mode === "cooked") arr.sort((a, b) => (b.lastCookedAt ?? 0) - (a.lastCookedAt ?? 0) || createdAtOf(b) - createdAtOf(a));
  else arr.sort((a, b) => createdAtOf(b) - createdAtOf(a));
  return arr;
}

export function createServer(): McpServer {
  const server = new McpServer({ name: "chef-world", title: "Chef World", version: "1.0.0" } as any);

  // Inline card (MCP Apps). One generic view renders every tool's "page" result.
  server.registerResource("card", VIEW_URI, { title: "Card", description: "Visual card for Chef World results.", mimeType: VIEW_MIME }, async () => ({
    contents: [{ uri: VIEW_URI, mimeType: VIEW_MIME, text: VIEW_HTML, _meta: { ui: { csp: VIEW_CSP, prefersBorder: false } } }],
  }));

  // ---------- account ----------
  server.registerTool(
    "whoami",
    {
      title: "👤 Account",
      description: "Shows which Chef World account this connector acts as (user id and sign-in method). Use it to check that the Claude link works.",
      inputSchema: {},
      annotations: { title: "Account", ...READ },
      _meta: UI_META,
    },
    safe(async () => {
      const s = await currentStore();
      const provider = s.provider === "anonymous" ? "guest (anonymous)" : s.provider || "unknown";
      return card(`Signed in as user ${s.uid} (sign-in: ${provider}).`, {
        kind: "page",
        title: "👤 Your account",
        sub: "Chef World",
        rows: [
          ["User ID", s.uid],
          ["Sign-in", provider],
          ["Email", s.email ? maskEmail(s.email) : "(none)"],
        ],
        note: "Source: Chef World (Firebase Auth)",
      });
    }),
  );

  // ---------- my recipes ----------
  server.registerTool(
    "list_my_recipes",
    {
      title: "🍳 My recipes",
      description:
        "Lists the recipes in the signed-in user's own collection (the 'My recipes' page), sorted and filtered as on the site, with favorites and publication status. Use it to find a recipe id before get_recipe, update_recipe or publish_recipe.",
      inputSchema: {
        query: z.string().trim().max(200).optional().describe("Text to find in name, tags or ingredients, e.g. 'chicken'."),
        tag: z.string().trim().max(40).optional().describe("Only recipes with this tag, e.g. 'Dessert'."),
        favorites_only: z.boolean().default(false).describe("true to list only favorites (the site's ★ Favorites filter)."),
        sort: sortSchema,
        limit: limitSchema,
      },
      annotations: { title: "My recipes", ...READ },
      _meta: UI_META,
    },
    safe(async (a: any) => {
      const s = await currentStore();
      const [all, pubs] = await Promise.all([s.listRecipes(), s.listMyPublic()]);
      const pubBySource = new Map(pubs.map((p) => [p.sourceId, p]));
      let list = all;
      if (a.query) list = list.filter((r) => contains([r.name, recipeTags(r).join(" "), r.ingredients.map((i) => ("section" in i ? i.section : i.text)).join(" ")].join(" "), a.query));
      if (a.tag) list = list.filter((r) => recipeTags(r).some((t) => t.toLowerCase() === a.tag.toLowerCase()));
      if (a.favorites_only) list = list.filter((r) => r.favorite === true);
      list = sortRecipes(list, a.sort ?? "added").slice(0, a.limit ?? 50);
      const pubLabel = (r: Recipe) => {
        const p = pubBySource.get(r.id);
        return p ? (p.visibility === "unlisted" ? "unlisted" : "public") : undefined;
      };
      const lines = list.map((r) => `- ${r.id}: ${r.emoji} ${r.name}${r.favorite ? " ★" : ""}${recipeTags(r).length ? ` (${recipeTags(r).join(", ")})` : ""}${pubLabel(r) ? ` [published: ${pubLabel(r)}]` : ""}`);
      const t = `${list.length} of ${all.length} recipes${a.query || a.tag ? " match" : ""}.\n${lines.join("\n") || "No recipes yet."}`;
      return card(t, listPage("🍳 My recipes", `${all.length} recipes · ${pubs.length} published`, list.map((r) => recipeItem(r, pubLabel(r))), [], "No matching recipes."));
    }),
  );

  server.registerTool(
    "get_recipe",
    {
      title: "📖 Recipe",
      description: "Returns one of the signed-in user's recipes in full (ingredients, steps, notes) and whether it is published. Use it before editing or publishing.",
      inputSchema: { id: idSchema, units: unitsSchema },
      annotations: { title: "Recipe", ...READ },
      _meta: UI_META,
    },
    safe(async (a: any) => {
      const s = await currentStore();
      const got = await s.getRecipe(a.id);
      if (!got) return fail(`⚠️ No recipe with id "${a.id}" in your account. Use list_my_recipes to find the right id.`);
      const pub = await s.getPublic(`${s.uid}_${a.id}`);
      const link = pub ? shareLink(pub.pubId) : null;
      const status = pub
        ? `Published (${pub.visibility}, ${pub.language}).${link ? ` Share link: ${link}` : ""}`
        : "Not published.";
      const personal = [
        ...(got.recipe.favorite ? ["★ In your favorites."] : []),
        ...(got.recipe.lastCookedAt ? [`Last cooked: ${dayOf(got.recipe.lastCookedAt)}.`] : []),
      ];
      const publication = pub ? { language: pub.language, visibility: pub.visibility, pubId: pub.pubId } : null;
      const view = withUnits(got.recipe, a.units ?? "original");
      return card(recipeText(view, [status, ...personal]), recipePage(view, { publication }));
    }),
  );

  // ---------- writes to my recipes (same as the site's form) ----------
  server.registerTool(
    "create_recipe",
    {
      title: "➕ New recipe",
      description:
        "Creates a recipe in the signed-in user's collection, exactly as the site's 'New Recipe' form does. Use it for a recipe the user types, pastes or describes, including one parsed from text or a web page. The recipe is private until publish_recipe is called.",
      inputSchema: createShape,
      annotations: { title: "New recipe", ...WRITE },
      _meta: UI_META,
    },
    safe(async (a: any) => {
      const input = a as RecipeInput & { name: string };
      if (!input.steps?.length) return fail("⚠️ A recipe needs at least one step (the site requires it too).");
      const s = await currentStore();
      const recipe = buildRecipe(newRecipeId(), input);
      await s.putRecipe(recipe);
      return card(`Saved "${recipe.name}" to your recipes (id ${recipe.id}).\n\n${recipeText(recipe)}`, recipePage(recipe));
    }),
  );

  server.registerTool(
    "update_recipe",
    {
      title: "✏️ Edit recipe",
      description:
        "Edits one of the user's recipes. Only the fields you pass change; ingredients and steps, when passed, replace the old lists. It does not change a published copy: call publish_recipe again to update that.",
      inputSchema: updateShape,
      annotations: { title: "Edit recipe", ...REPLACE },
      _meta: UI_META,
    },
    safe(async (a: any) => {
      const s = await currentStore();
      const got = await s.getRecipe(a.id);
      if (!got) return fail(`⚠️ No recipe with id "${a.id}" in your account. Use list_my_recipes to find the right id.`);
      if (a.steps && !a.steps.length) return fail("⚠️ A recipe needs at least one step. Pass the full list of steps.");
      const next = buildRecipe(got.recipe.id, a as RecipeInput, got.recipe);
      await s.putRecipe(next, got.updateTime);
      return card(`Updated "${next.name}".\n\n${recipeText(next)}`, recipePage(next));
    }),
  );

  server.registerTool(
    "delete_recipe",
    {
      title: "🗑️ Delete recipe",
      description:
        "Permanently deletes one of the user's private recipes, as the site's Delete button does. Requires confirm=true, which you may set only after the user explicitly approved this deletion in the chat. A published copy is NOT removed: call unpublish_recipe for that.",
      inputSchema: { id: idSchema, confirm: confirmSchema("deleting this recipe") },
      annotations: { title: "Delete recipe", ...DESTROY },
      _meta: UI_META,
    },
    safe(async (a: any) => {
      const s = await currentStore();
      const got = await s.getRecipe(a.id);
      if (!got) return fail(`⚠️ No recipe with id "${a.id}" in your account.`);
      await s.deleteRecipe(a.id);
      const pub = await s.getPublic(`${s.uid}_${a.id}`);
      const warn = pub ? " Its published copy is still live; use unpublish_recipe to remove it." : "";
      return card(`Deleted "${got.recipe.name}".${warn}`, {
        kind: "page",
        title: `🗑️ Deleted: ${got.recipe.name}`,
        sub: "Removed from your recipes",
        note: warn.trim() || "Source: Chef World",
      });
    }),
  );

  // ---------- publishing (outward-facing: needs explicit approval) ----------
  server.registerTool(
    "publish_recipe",
    {
      title: "🌐 Publish recipe",
      description:
        "Publishes one of the user's recipes to Chef World's community feed: 'public' is listed for all signed-in users, 'unlisted' is visible only to people with the link. Call it only after the user explicitly approved this exact publish in the chat (recipe, language, visibility). Calling it again updates the published copy.",
      inputSchema: {
        id: idSchema,
        language: z.enum(LANGUAGES).optional().describe("Language of the recipe. Default: the current publication's language, or English."),
        visibility: z.enum(VISIBILITY).optional().describe("'public' (listed) or 'unlisted' (link only). Default: the current one, or public."),
        confirm_publish: confirmSchema("publishing this recipe with these settings"),
      },
      annotations: { title: "Publish recipe", ...REPLACE },
      _meta: UI_META,
    },
    safe(async (a: any) => {
      const s = await currentStore();
      const got = await s.getRecipe(a.id);
      if (!got) return fail(`⚠️ No recipe with id "${a.id}" in your account.`);
      assertPublishable(got.recipe);
      const existing = await s.getPublic(`${s.uid}_${a.id}`);
      const pub: Pub = {
        ...withoutPersonalFields(got.recipe),
        pubId: `${s.uid}_${got.recipe.id}`,
        sourceId: got.recipe.id,
        ownerId: s.uid,
        ownerLabel: s.provider === "anonymous" ? "Guest" : maskEmail(s.email),
        language: a.language ?? existing?.language ?? "English",
        visibility: a.visibility ?? existing?.visibility ?? "public",
        publishedAt: Date.now(),
      };
      await s.putPublic(pub);
      const link = shareLink(pub.pubId);
      const t = `Published "${pub.name}" (${pub.visibility}, ${pub.language}).${link ? ` Share link: ${link}` : ""}`;
      return card(t, recipePage(pub, { publication: { language: pub.language, visibility: pub.visibility, pubId: pub.pubId }, owner: pub.ownerLabel, heading: `Published · ${pub.visibility} · ${pub.language}` }));
    }),
  );

  server.registerTool(
    "unpublish_recipe",
    {
      title: "🔒 Unpublish recipe",
      description:
        "Removes the user's published copy of a recipe from the community feed and from share links. The private recipe is kept. Requires confirm=true, set only after the user explicitly approved it in the chat.",
      inputSchema: { id: idSchema, confirm: confirmSchema("unpublishing this recipe") },
      annotations: { title: "Unpublish recipe", ...DESTROY },
      _meta: UI_META,
    },
    safe(async (a: any) => {
      const s = await currentStore();
      const pub = await s.getPublic(`${s.uid}_${a.id}`);
      if (!pub) return text(`"${a.id}" is not published, so nothing changed.`);
      await s.deletePublic(pub.pubId);
      return card(`Unpublished "${pub.name}". Your private recipe is unchanged.`, {
        kind: "page",
        title: `🔒 Unpublished: ${pub.name}`,
        sub: "No longer in the community feed",
        note: "Source: Chef World",
      });
    }),
  );

  // ---------- community ----------
  server.registerTool(
    "list_community_recipes",
    {
      title: "🌐 Community",
      description:
        "Lists recipes other users published on Chef World (the Community page), newest first. Unlisted recipes are not included; open one with its link via get_community_recipe. Use it to browse or find a recipe to save.",
      inputSchema: {
        query: z.string().trim().max(200).optional().describe("Text to find in name, tags or ingredients, e.g. 'soup'."),
        tag: z.string().trim().max(40).optional().describe("Only recipes with this tag, e.g. 'Vegan'."),
        language: z.enum(LANGUAGES).optional().describe("Only recipes published in this language, e.g. 'Hebrew'."),
        limit: limitSchema,
      },
      annotations: { title: "Community", ...READ },
      _meta: UI_META,
    },
    safe(async (a: any) => {
      const s = await currentStore();
      let list = (await s.listPublic()).filter((p) => p.visibility !== "unlisted");
      if (a.query) list = list.filter((p) => contains([p.name, recipeTags(p).join(" "), p.ingredients.map((i) => ("section" in i ? i.section : i.text)).join(" ")].join(" "), a.query));
      if (a.tag) list = list.filter((p) => recipeTags(p).some((t) => t.toLowerCase() === a.tag.toLowerCase()));
      if (a.language) list = list.filter((p) => p.language === a.language);
      list = list.sort((x, y) => (y.publishedAt ?? 0) - (x.publishedAt ?? 0)).slice(0, a.limit ?? 50);
      const lines = list.map((p) => `- ${p.pubId}: ${p.emoji} ${p.name} · by ${p.ownerLabel || "Chef"} · ${p.language}`);
      const t = `${list.length} community recipes.\n${lines.join("\n") || "No matching recipes."}`;
      return card(t, listPage("🌐 Community", `${list.length} published recipes`, list.map(communityItem), [], "No matching recipes."));
    }),
  );

  server.registerTool(
    "get_community_recipe",
    {
      title: "🌐 Community recipe",
      description:
        "Returns a published recipe from the community (by its id or its share link), including unlisted ones opened by link. Use it to read a shared recipe or before save_copy_to_mine.",
      inputSchema: { pubId: pubIdSchema, units: unitsSchema },
      annotations: { title: "Community recipe", ...READ },
      _meta: UI_META,
    },
    safe(async (a: any) => {
      const s = await currentStore();
      const p = await s.getPublic(parsePubId(a.pubId));
      if (!p) return fail("⚠️ This recipe is no longer published, or the link is wrong.");
      const view = withUnits(p, a.units ?? "original");
      const t = recipeText(view, [`Published by ${p.ownerLabel || "Chef"} · ${p.language} · ${p.visibility}`]);
      return card(t, recipePage(view, { owner: p.ownerLabel || "Chef", publication: { language: p.language, visibility: p.visibility, pubId: p.pubId } }));
    }),
  );

  server.registerTool(
    "save_copy_to_mine",
    {
      title: "⭐ Save to mine",
      description:
        "Copies a community recipe into the signed-in user's own recipes, as the site's 'Save to mine' button does. The copy is private and independent of the original.",
      inputSchema: { pubId: pubIdSchema },
      annotations: { title: "Save to mine", ...WRITE },
      _meta: UI_META,
    },
    safe(async (a: any) => {
      const s = await currentStore();
      const p = await s.getPublic(parsePubId(a.pubId));
      if (!p) return fail("⚠️ This recipe is no longer published, or the link is wrong.");
      const copy: Recipe = {
        id: newRecipeId(),
        emoji: p.emoji,
        name: p.name,
        time: p.time,
        prepTime: p.prepTime,
        cookTime: p.cookTime,
        servings: p.servings,
        servingsUnit: p.servingsUnit,
        tags: recipeTags(p),
        tag: p.tag,
        difficulty: p.difficulty,
        notes: p.notes,
        ingredients: p.ingredients,
        steps: p.steps,
      };
      await s.putRecipe(copy);
      return card(`Saved a copy of "${p.name}" to your recipes (id ${copy.id}).`, recipePage(copy, { heading: `Copied from ${p.ownerLabel || "Chef"}` }));
    }),
  );

  server.registerTool(
    "get_share_link",
    {
      title: "🔗 Share link",
      description: "Returns the public share link of one of the user's published recipes. The recipe must be published first (publish_recipe).",
      inputSchema: { id: idSchema },
      annotations: { title: "Share link", ...READ },
      _meta: UI_META,
    },
    safe(async (a: any) => {
      const s = await currentStore();
      const pub = await s.getPublic(`${s.uid}_${a.id}`);
      if (!pub) return fail(`⚠️ "${a.id}" is not published. Publish it with publish_recipe first.`);
      const link = shareLink(pub.pubId);
      if (!link) return fail(`⚠️ Share link unavailable: SITE_URL is not set on the server. Pub ID: ${pub.pubId}`);
      return text(`Share link for "${pub.name}" (${pub.visibility}): ${link}`);
    }),
  );

  // ---------- features the site has too: favorites, cooked, backup ----------
  server.registerTool(
    "set_favorite",
    {
      title: "★ Favorite",
      description:
        "Adds or removes one of the user's own recipes from their favorites, as the site's star does. Favorites are private and never published.",
      inputSchema: { id: idSchema, favorite: z.boolean().describe("true to add to favorites, false to remove.") },
      annotations: { title: "Favorite", ...REPLACE },
      _meta: UI_META,
    },
    safe(async (a: any) => {
      const s = await currentStore();
      const got = await s.getRecipe(a.id);
      if (!got) return fail(`⚠️ No recipe with id "${a.id}" in your account. Use list_my_recipes to find the right id.`);
      await s.updateFields(a.id, { favorite: a.favorite });
      const next: Recipe = { ...got.recipe, favorite: a.favorite };
      return card(a.favorite ? `Added "${next.name}" to favorites.` : `Removed "${next.name}" from favorites.`, recipePage(next));
    }),
  );

  server.registerTool(
    "mark_cooked",
    {
      title: "🍽️ Mark cooked",
      description:
        "Records that the user cooked one of their own recipes now, as starting Cook mode on the site does. It drives the 'Recently cooked' order. Use it when the user says they just made a recipe.",
      inputSchema: { id: idSchema },
      annotations: { title: "Mark cooked", ...WRITE },
      _meta: UI_META,
    },
    safe(async (a: any) => {
      const s = await currentStore();
      const got = await s.getRecipe(a.id);
      if (!got) return fail(`⚠️ No recipe with id "${a.id}" in your account. Use list_my_recipes to find the right id.`);
      const now = Date.now();
      await s.updateFields(a.id, { lastCookedAt: now });
      return card(`Marked "${got.recipe.name}" as cooked today.`, recipePage({ ...got.recipe, lastCookedAt: now }));
    }),
  );

  server.registerTool(
    "export_recipes",
    {
      title: "⬇ Export",
      description:
        "Returns all of the user's own recipes as JSON in the site's backup format ({app, version, exportedAt, recipes}), including favorites and cooked dates. Published copies are not included. Save the text to a file for the user.",
      inputSchema: {},
      annotations: { title: "Export recipes", ...READ },
    },
    safe(async () => {
      const s = await currentStore();
      const recipes = await s.listRecipes();
      const payload = { app: "chef-world", version: 1, exportedAt: new Date().toISOString(), recipes };
      return text(JSON.stringify(payload, null, 2));
    }),
  );

  server.registerTool(
    "import_recipes",
    {
      title: "⬆ Import",
      description:
        "Adds recipes from a JSON backup, as the site's Import button does: pass the 'recipes' array from an exported file (up to 100 per call). Entries without a name or a step are skipped. An entry whose id already exists overwrites that recipe. Requires confirm=true, set only after the user explicitly approved the import in the chat.",
      inputSchema: {
        recipes: z.array(z.record(z.string(), z.unknown())).min(1).max(100).describe("The recipes to add, each in the export format."),
        confirm: confirmSchema("importing these recipes (existing recipes with the same id are overwritten)"),
      },
      annotations: { title: "Import recipes", ...WRITE },
      _meta: UI_META,
    },
    safe(async (a: any) => {
      const s = await currentStore();
      const valid = (a.recipes as unknown[]).map((raw) => sanitizeImported(raw)).filter((r): r is Recipe => r !== null);
      if (!valid.length) return fail("⚠️ No valid recipes: each one needs a name and at least one step.");
      for (const r of valid) await s.putRecipe(r);
      const skipped = a.recipes.length - valid.length;
      const t = `Imported ${valid.length} recipe(s)${skipped ? `; skipped ${skipped} incomplete entr${skipped === 1 ? "y" : "ies"}` : ""}.`;
      return card(t, listPage("📥 Imported", `${valid.length} recipes${skipped ? ` · ${skipped} skipped` : ""}`, valid.map((r) => recipeItem(r))));
    }),
  );

  return server;
}
