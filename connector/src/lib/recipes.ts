// Chef World recipe model. Field names and shapes match what the site writes (index.html: saveRecipe,
// publishRecipe, saveCopyToMine), so documents written here show up correctly in the site and pass its rules.
import { UpstreamError } from "./http.js";

export const LANGUAGES = ["English", "Hebrew", "Spanish", "French", "German", "Italian", "Portuguese", "Arabic", "Russian", "Chinese", "Japanese", "Other"] as const;
export const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
export const VISIBILITY = ["public", "unlisted"] as const;

export type Ingredient = { section: string } | { quantity: string; unit: string; name: string; text: string };
export type Step = { text: string; seconds: number | null };

export type Recipe = {
  id: string;
  emoji: string;
  name: string;
  time: string;
  prepTime: string;
  cookTime: string;
  servings: string;
  servingsUnit: string;
  tags: string[];
  tag: string;
  difficulty: string;
  notes: string;
  ingredients: Ingredient[];
  steps: Step[];
  /** Personal fields, set by the site's star and Cook mode. They are never published. */
  favorite?: boolean;
  lastCookedAt?: number;
  /** Set when the recipe is in the app's trash (ms timestamp). Trashed recipes are hidden from the connector. */
  deletedAt?: number | null;
};

/** The only fields set_favorite and mark_cooked change. */
export type PersonalFields = { favorite?: boolean; lastCookedAt?: number };

/** A published copy, stored at publicRecipes/{uid}_{recipeId}. */
export type Pub = Recipe & {
  pubId: string;
  sourceId: string;
  ownerId: string;
  ownerLabel: string;
  language: string;
  visibility: string;
  publishedAt: number;
};

/** Input as the model sends it. Mirrors the site's recipe form. */
export type RecipeInput = {
  emoji?: string;
  name?: string;
  prepTime?: string;
  cookTime?: string;
  servings?: string;
  servingsUnit?: string;
  tags?: string[];
  difficulty?: string;
  notes?: string;
  ingredients?: { section?: string; quantity?: string; unit?: string; name?: string }[];
  steps?: { text: string; minutes?: number | null }[];
};

export const newRecipeId = (): string => "r_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function maskEmail(email: string): string {
  if (!email) return "Chef";
  const [local] = email.split("@");
  if (local.length <= 2) return local[0] + "***";
  return local[0] + "***" + local[local.length - 1];
}

export function recipeTags(r: Pick<Recipe, "tags" | "tag">): string[] {
  if (Array.isArray(r.tags)) return r.tags.filter(Boolean);
  return r.tag ? String(r.tag).split(",").map((t) => t.trim()).filter(Boolean) : [];
}

export function ingredientText(i: { quantity?: string; unit?: string; name?: string }): string {
  return [i.quantity, i.unit, i.name].filter(Boolean).join(" ");
}

/** Builds the stored shape from input. `base` is the existing recipe when updating (fields not given are kept). */
export function buildRecipe(id: string, input: RecipeInput, base?: Recipe): Recipe {
  const b = base ?? ({} as Partial<Recipe>);
  const tags = input.tags ?? recipeTags(b as Recipe);
  const prep = input.prepTime ?? b.prepTime ?? b.time ?? "";
  const ingredients: Ingredient[] = input.ingredients
    ? input.ingredients
        .filter((i) => i.section || i.name || i.quantity)
        .map((i) =>
          i.section
            ? { section: i.section.trim() }
            : { quantity: (i.quantity ?? "").trim(), unit: (i.unit ?? "").trim(), name: (i.name ?? "").trim(), text: ingredientText(i) },
        )
    : (b.ingredients ?? []);
  const steps: Step[] = input.steps
    ? input.steps
        .map((s) => ({ text: s.text.trim(), seconds: s.minutes && s.minutes > 0 ? Math.round(s.minutes * 60) : null }))
        .filter((s) => s.text)
    : (b.steps ?? []);
  return {
    ...b, // keeps fields this connector does not set, such as favorite and lastCookedAt
    id,
    emoji: (input.emoji ?? b.emoji ?? "").trim() || "🍽️",
    name: (input.name ?? b.name ?? "").trim(),
    time: prep,
    prepTime: prep,
    cookTime: input.cookTime ?? b.cookTime ?? "",
    servings: input.servings ?? b.servings ?? "",
    servingsUnit: (input.servingsUnit ?? b.servingsUnit ?? "").trim() || "servings",
    tags,
    tag: tags.join(", "),
    difficulty: input.difficulty ?? b.difficulty ?? "",
    notes: input.notes ?? b.notes ?? "",
    ingredients,
    steps,
  };
}

/** Personal fields stay private: a published copy never carries them (the site strips them too). */
export function withoutPersonalFields<T extends Recipe>(r: T): T {
  const shared: Partial<Recipe> = { ...r };
  delete shared.favorite;
  delete shared.lastCookedAt;
  return shared as T;
}

/** Recipe ids start with "r_" and a base-36 timestamp (uid() in index.html), so the creation time can be read from them. */
export function createdAtOf(r: { id: string }): number {
  const m = /^r_([0-9a-z]{8})/.exec(String(r.id ?? ""));
  return m ? parseInt(m[1], 36) : 0;
}

/** Keeps only known fields and fixes their types, like the site's import. Null when there is no name or no step. */
export function sanitizeImported(raw: unknown): Recipe | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, any>;
  const name = String(o.name ?? "").trim();
  const steps: Step[] = (Array.isArray(o.steps) ? o.steps : [])
    .map((s: any): Step | null => {
      const text = String(s?.text ?? "").trim();
      const secs = Number(s?.seconds);
      return text ? { text, seconds: Number.isFinite(secs) && secs > 0 ? Math.round(secs) : null } : null;
    })
    .filter((s: Step | null): s is Step => s !== null);
  if (!name || !steps.length) return null;
  const ingredients: Ingredient[] = (Array.isArray(o.ingredients) ? o.ingredients : [])
    .map((i: any): Ingredient | null => {
      if (!i || typeof i !== "object") return null;
      if (i.section != null) return { section: String(i.section) };
      const quantity = String(i.quantity ?? "").trim();
      const unit = String(i.unit ?? "").trim();
      const itemName = String(i.name ?? "").trim();
      const text = i.text != null ? String(i.text) : ingredientText({ quantity, unit, name: itemName });
      return quantity || unit || itemName || text ? { quantity, unit, name: itemName, text } : null;
    })
    .filter((i: Ingredient | null): i is Ingredient => i !== null);
  const tags = recipeTags(o as Pick<Recipe, "tags" | "tag">).map(String);
  const prep = String(o.prepTime ?? o.time ?? "");
  const recipe: Recipe = {
    id: /^r_[0-9a-z]{8,}$/.test(String(o.id ?? "")) ? String(o.id) : newRecipeId(),
    emoji: String(o.emoji || "🍽️"),
    name,
    time: prep,
    prepTime: prep,
    cookTime: String(o.cookTime ?? ""),
    servings: String(o.servings ?? ""),
    servingsUnit: String(o.servingsUnit || "servings"),
    tags,
    tag: tags.join(", "),
    difficulty: String(o.difficulty ?? ""),
    notes: String(o.notes ?? ""),
    ingredients,
    steps,
  };
  if (typeof o.favorite === "boolean") recipe.favorite = o.favorite;
  if (Number.isFinite(o.lastCookedAt)) recipe.lastCookedAt = o.lastCookedAt;
  return recipe;
}

export function assertPublishable(r: Recipe): void {
  if (!r.name) throw new UpstreamError("This recipe has no name, so it cannot be published.", "chef-world");
  if (!r.steps.length) throw new UpstreamError("This recipe has no steps. Add at least one step before publishing.", "chef-world");
}

/** Short form for list results. */
export function summarize(r: Recipe) {
  return {
    id: r.id,
    emoji: r.emoji,
    name: r.name,
    tags: recipeTags(r),
    prepTime: r.prepTime || r.time || "",
    cookTime: r.cookTime || "",
    servings: r.servings || "",
    servingsUnit: r.servingsUnit || "servings",
    difficulty: r.difficulty || "",
    ingredients: r.ingredients.length,
    steps: r.steps.length,
  };
}

export function ingredientLine(i: Ingredient): string {
  if ("section" in i) return `— ${i.section} —`;
  return i.text || ingredientText(i) || "(empty)";
}

export function stepLine(s: Step, n: number): string {
  return `${n}. ${s.text}${s.seconds ? ` (${Math.round(s.seconds / 60)} min)` : ""}`;
}

/** Plain-text rendering of a recipe, used as the model-facing answer. */
export function recipeText(r: Recipe, extra: string[] = []): string {
  const lines: string[] = [`${r.emoji} ${r.name}`];
  const meta = [
    (r.prepTime || r.time) && `Prep ${r.prepTime || r.time} min`,
    r.cookTime && `Cook ${r.cookTime} min`,
    r.servings && `Serves ${r.servings} ${r.servingsUnit}`,
    r.difficulty && `Difficulty ${r.difficulty}`,
    recipeTags(r).length && `Tags: ${recipeTags(r).join(", ")}`,
  ].filter(Boolean);
  if (meta.length) lines.push(meta.join(" · "));
  lines.push("", "Ingredients:", ...(r.ingredients.length ? r.ingredients.map((i) => `- ${ingredientLine(i)}`) : ["- (none)"]));
  lines.push("", "Steps:", ...(r.steps.length ? r.steps.map((s, i) => stepLine(s, i + 1)) : ["(none)"]));
  if (r.notes) lines.push("", `Notes: ${r.notes}`);
  if (extra.length) lines.push("", ...extra);
  lines.push("", "Source: Chef World (your recipes in Firestore).");
  return lines.join("\n");
}
