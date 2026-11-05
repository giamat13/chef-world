// Card data for the inline view (kind: "page"). Every tool returns one of these as structuredContent,
// so reads and writes both refresh the card. Items with `call` navigate inside the card.
import { ingredientLine, recipeTags, type Pub, type Recipe } from "./recipes.js";

export type Call = { name: string; arguments: Record<string, unknown> };
export type Item = { icon?: string; title: string; sub?: string; badge?: string; url?: string; call?: Call };
export type Page = {
  kind: "page";
  title: string;
  sub?: string;
  chips?: string[];
  rows?: [string, string][];
  sections?: { heading: string; empty?: string; items: Item[] }[];
  note?: string;
};

const ok = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== "";
export const dayOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export function listPage(title: string, sub: string, items: Item[], chips: string[] = [], empty = "Nothing here yet."): Page {
  return { kind: "page", title, sub, chips, sections: [{ heading: "Recipes", empty, items }], note: "Source: Chef World" };
}

export function recipePage(
  r: Recipe,
  opts: { heading?: string; publication?: { language: string; visibility: string; pubId: string } | null; owner?: string; note?: string } = {},
): Page {
  const tags = recipeTags(r);
  const pub = opts.publication;
  const chips = [
    ok(r.prepTime || r.time) && `⏱ ${r.prepTime || r.time} min prep`,
    ok(r.cookTime) && `🍳 ${r.cookTime} min cook`,
    ok(r.servings) && `🍴 ${r.servings} ${r.servingsUnit || "servings"}`,
    ok(r.difficulty) && r.difficulty,
    pub && `🌐 ${pub.visibility === "unlisted" ? "unlisted" : "public"} · ${pub.language}`,
    ...tags.map((t) => `#${t}`),
  ].filter(Boolean) as string[];
  const ingredients: Item[] = r.ingredients.map((i) =>
    "section" in i ? { icon: "📂", title: i.section } : { icon: "•", title: ingredientLine(i) },
  );
  const steps: Item[] = r.steps.map((s, i) => ({
    icon: `${i + 1}.`,
    title: s.text,
    badge: s.seconds ? `${Math.round(s.seconds / 60)} min` : undefined,
  }));
  return {
    kind: "page",
    title: `${r.emoji || "🍽️"} ${r.name}`,
    sub: opts.heading ?? (opts.owner ? `Community · by ${opts.owner}` : "Your recipe"),
    chips,
    rows: [
      ...(ok(r.difficulty) ? [["Difficulty", r.difficulty] as [string, string]] : []),
      ...(r.favorite ? [["Favorite", "★ yes"] as [string, string]] : []),
      ...(r.lastCookedAt ? [["Last cooked", dayOf(r.lastCookedAt)] as [string, string]] : []),
      ...(opts.owner ? [["Shared by", opts.owner] as [string, string]] : []),
      ...(pub ? [["Pub ID", pub.pubId] as [string, string]] : []),
    ],
    sections: [
      { heading: "Ingredients", empty: "No ingredients.", items: ingredients },
      { heading: "Steps", empty: "No steps.", items: steps },
    ],
    note: opts.note ?? (ok(r.notes) ? r.notes : "Source: Chef World"),
  };
}

export function communityItem(p: Pub): Item {
  const tags = recipeTags(p);
  return {
    icon: p.emoji || "🍽️",
    title: p.name,
    sub: [`by ${p.ownerLabel || "Chef"}`, p.language, tags.join(", ")].filter(Boolean).join(" · "),
    badge: p.visibility === "unlisted" ? "unlisted" : undefined,
    call: { name: "get_community_recipe", arguments: { pubId: p.pubId } },
  };
}

export function recipeItem(r: Recipe, publicLabel?: string): Item {
  return {
    icon: r.emoji || "🍽️",
    title: r.name,
    sub: [
      (r.prepTime || r.time) && `⏱ ${r.prepTime || r.time} min`,
      r.servings && `🍴 ${r.servings} ${r.servingsUnit || "servings"}`,
      r.favorite ? "★ favorite" : "",
      recipeTags(r).join(", "),
    ]
      .filter(Boolean)
      .join(" · "),
    badge: publicLabel,
    call: { name: "get_recipe", arguments: { id: r.id } },
  };
}
