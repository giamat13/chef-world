// Unit conversion for display only, ported from index.html (convertToSystem, parseIngredientQuantity,
// parseLeadingNumber). The saved recipe never changes: only the text shown for ingredients does.
import { ingredientText, type Ingredient, type Recipe } from "./recipes.js";

export const UNIT_SYSTEMS = ["original", "metric", "us"] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];
type System = "metric" | "us";

// Unit (and its aliases) -> base unit (g or ml), its size in the base unit, and its system.
const UNIT_TABLE: [string, "g" | "ml", number, System, string[]][] = [
  ["g", "g", 1, "metric", ["gram", "grams"]],
  ["kg", "g", 1000, "metric", ["kilo", "kilos", "kilogram", "kilograms"]],
  ["oz", "g", 28.3495, "us", ["ounce", "ounces"]],
  ["lb", "g", 453.592, "us", ["lbs", "pound", "pounds"]],
  ["ml", "ml", 1, "metric", ["milliliter", "milliliters", "millilitre", "millilitres"]],
  ["l", "ml", 1000, "metric", ["liter", "liters", "litre", "litres"]],
  ["tsp", "ml", 4.92892, "us", ["teaspoon", "teaspoons"]],
  ["tbsp", "ml", 14.7868, "us", ["tbs", "tablespoon", "tablespoons"]],
  ["cup", "ml", 236.588, "us", ["cups"]],
];
const UNIT_INFO = new Map<string, { base: "g" | "ml"; factor: number; system: System }>();
for (const [unit, base, factor, system, aliases] of UNIT_TABLE)
  for (const name of [unit, ...aliases]) UNIT_INFO.set(name, { base, factor, system });

const UNICODE_FRACTIONS: Record<string, number> = {
  "¼": 1 / 4, "½": 1 / 2, "¾": 3 / 4, "⅓": 1 / 3, "⅔": 2 / 3, "⅕": 1 / 5, "⅖": 2 / 5, "⅗": 3 / 5, "⅘": 4 / 5,
  "⅙": 1 / 6, "⅚": 5 / 6, "⅐": 1 / 7, "⅛": 1 / 8, "⅜": 3 / 8, "⅝": 5 / 8, "⅞": 7 / 8, "⅑": 1 / 9, "⅒": 1 / 10,
};

function parseLeadingNumber(text: string): { value: number; matchLength: number } | null {
  const uni = text.match(/^(\d+\s*)?([¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞⅑⅒])/);
  if (uni) {
    const whole = uni[1] ? parseFloat(uni[1]) : 0;
    return { value: whole + (UNICODE_FRACTIONS[uni[2]] ?? 0), matchLength: uni[0].length };
  }
  const m = text.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(\.\d+)?)/);
  if (!m) return null;
  const raw = m[1];
  let value: number;
  if (/\d+\s+\d+\/\d+/.test(raw)) {
    const [whole, frac] = raw.split(/\s+/);
    const [n, d] = frac.split("/").map(Number);
    value = Number(whole) + n / d;
  } else if (raw.includes("/")) {
    const [n, d] = raw.split("/").map(Number);
    value = n / d;
  } else {
    value = parseFloat(raw);
  }
  return { value, matchLength: raw.length };
}

function niceNumber(n: number): string {
  const f = n >= 10 ? 1 : n >= 1 ? 10 : 100;
  return String(Math.round(n * f) / f);
}

function convert(value: number, unitKey: string, system: System): { value: string; unit: string } | null {
  const info = UNIT_INFO.get(unitKey.toLowerCase().replace(/\.$/, ""));
  if (!info || info.system === system) return null;
  const amount = value * info.factor; // grams or millilitres
  let out: number;
  let unit: string;
  if (info.base === "g") {
    const heavy = amount >= (system === "metric" ? 1000 : 453.592);
    if (system === "metric") {
      out = heavy ? amount / 1000 : amount;
      unit = heavy ? "kg" : "g";
    } else {
      out = heavy ? amount / 453.592 : amount / 28.3495;
      unit = heavy ? "lb" : "oz";
    }
  } else if (system === "metric") {
    const large = amount >= 1000;
    out = large ? amount / 1000 : amount;
    unit = large ? "l" : "ml";
  } else if (amount >= 236.588) {
    out = amount / 236.588;
    unit = "cup";
  } else if (amount >= 14.7868) {
    out = amount / 14.7868;
    unit = "tbsp";
  } else {
    out = amount / 4.92892;
    unit = "tsp";
  }
  const shown = niceNumber(out);
  return { value: shown, unit: unit === "cup" && shown !== "1" ? "cups" : unit };
}

/** Reads quantity, unit and name from a structured ingredient, or from its text. */
function quantityOf(i: { quantity?: string; unit?: string; name?: string; text?: string }): { value: number; unit: string; name: string } | null {
  if (i.quantity && i.unit) {
    const q = parseLeadingNumber(String(i.quantity).trim());
    return q ? { value: q.value, unit: String(i.unit).trim(), name: i.name || "" } : null;
  }
  const text = String(i.text ?? "").trim();
  const q = parseLeadingNumber(text);
  if (!q) return null;
  const m = text.slice(q.matchLength).trim().match(/^([A-Za-z]+\.?)(?:\s+([\s\S]*))?$/);
  return m ? { value: q.value, unit: m[1], name: m[2] || "" } : null;
}

function ingredientIn(i: Ingredient, system: System): string {
  if ("section" in i) return i.section;
  const saved = i.text || ingredientText(i);
  const parsed = quantityOf(i);
  const conv = parsed ? convert(parsed.value, parsed.unit, system) : null;
  return conv && parsed ? [conv.value, conv.unit, parsed.name].filter(Boolean).join(" ") : saved;
}

/** The recipe with its ingredient text in the chosen unit system. Ingredients that cannot be converted keep their text. */
export function withUnits<T extends Recipe>(r: T, system: UnitSystem): T {
  if (system === "original") return r;
  const ingredients = r.ingredients.map((i): Ingredient => ("section" in i ? i : { ...i, text: ingredientIn(i, system) }));
  return { ...r, ingredients } as T;
}
