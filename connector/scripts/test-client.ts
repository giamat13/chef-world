// Calls EVERY tool through a real MCP client, in a realistic order:
// create -> edit -> favorite -> cooked -> units -> publish -> copy -> backup -> cleanup.
// Usage: npm test -- "http://localhost:3000/mcp?key=mock"   (start the server with CHEF_MOCK=1 first)
// Exits 1 on any unexpected error, empty output, failed check, or any registered tool that was not called.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = process.argv[2] ?? "http://localhost:3000/mcp?key=mock";
const client = new Client({ name: "chef-world-test", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(url)));

const tools = await client.listTools();
const tested = new Set<string>();
let bad = 0;

async function call(name: string, args: Record<string, unknown>, expectError = false): Promise<string> {
  tested.add(name);
  const t0 = Date.now();
  let r: any;
  try {
    r = await client.callTool({ name, arguments: args });
  } catch (e) {
    r = { isError: true, content: [{ type: "text", text: String(e) }] };
  }
  const txt: string = (r.content ?? []).map((c: any) => c.text ?? "").join("\n");
  const problem = expectError ? !r.isError : r.isError || txt.trim().length < 5;
  if (problem) bad++;
  const label = problem ? "PROBLEM" : r.isError ? "expected error" : "ok";
  console.log(`\n=== ${name} ${JSON.stringify(args).slice(0, 140)} — ${Date.now() - t0}ms ${label} ===`);
  console.log(process.env.FULL ? txt : txt.split("\n").slice(0, 8).join("\n"));
  return txt;
}

/** Checks a behaviour that the plain call above cannot see (for example, that a field survived an edit). */
function check(ok: boolean, label: string): void {
  if (ok) console.log(`check ok: ${label}`);
  else {
    bad++;
    console.log(`PROBLEM check failed: ${label}`);
  }
}

const idFrom = (txt: string) => {
  const m = txt.match(/\bid (r_[A-Za-z0-9]+)/);
  if (!m) throw new Error(`no recipe id in: ${txt.slice(0, 120)}`);
  return m[1];
};

// 1. account
await call("whoami", {});

// 2. create (with a section header, a timer step and a plain ingredient)
const created = await call("create_recipe", {
  name: "Test pancakes",
  emoji: "🥞",
  prepTime: "10",
  cookTime: "15",
  servings: "4",
  tags: ["Breakfast", "Test"],
  difficulty: "Easy",
  notes: "Created by the test client.",
  ingredients: [{ quantity: "200", unit: "g", name: "flour" }, { section: "For the topping" }, { name: "maple syrup" }],
  steps: [{ text: "Mix everything", minutes: null }, { text: "Rest the batter", minutes: 10 }],
});
const id = idFrom(created);
await call("create_recipe", { name: "No steps" }, true); // edge: a recipe without steps must be refused

// 3. find, read, edit
await call("list_my_recipes", { query: "pancake" });
await call("get_recipe", { id });
await call("get_recipe", { id: "r_does_not_exist" }, true);
await call("update_recipe", { id, servings: "6", steps: [{ text: "Mix everything", minutes: null }, { text: "Rest the batter", minutes: 10 }, { text: "Fry", minutes: 2 }] });

// 3b. favorites, cooked time, sorting and unit display (features the site has)
await call("set_favorite", { id, favorite: true });
await call("set_favorite", { id: "r_does_not_exist", favorite: true }, true);
await call("update_recipe", { id, notes: "Edited after favoriting" });
const afterEdit = await call("get_recipe", { id });
check(afterEdit.includes("★ In your favorites"), "update_recipe keeps the favorite flag");
await call("mark_cooked", { id });
const afterCook = await call("get_recipe", { id });
check(afterCook.includes("Last cooked:"), "mark_cooked records the cooked day");
const favs = await call("list_my_recipes", { favorites_only: true, sort: "cooked" });
check(favs.includes("Test pancakes"), "favorites filter lists the recipe");
await call("list_my_recipes", { sort: "prep" });
const us = await call("get_recipe", { id, units: "us" });
check(us.includes("7.1 oz flour"), "units=us converts 200 g to 7.1 oz (saved text unchanged)");
const saved = await call("get_recipe", { id });
check(saved.includes("200 g flour"), "saved ingredient text is unchanged after a display conversion");

// 4. publish (needs confirm_publish) and share
await call("publish_recipe", { id, language: "English", visibility: "public", confirm_publish: true });
await call("get_share_link", { id });
await call("list_community_recipes", { query: "pancake" });
const pubId = `mock-user-0001_${id}`;
const community = await call("get_community_recipe", { pubId: `https://example.test/chef-world/?r=${encodeURIComponent(pubId)}`, units: "metric" });
check(!community.includes("★") && !community.includes("Last cooked"), "favorite and cooked dates are not published");

// 4b. backup: export, import one valid and one incomplete entry, and an import with nothing valid
const exported = await call("export_recipes", {});
check(exported.includes('"app": "chef-world"') && exported.includes(id), "export contains the test recipe");
await call(
  "import_recipes",
  {
    recipes: [
      { id: "r_testimport01", name: "Imported soup", prepTime: "5", steps: [{ text: "Boil", seconds: 300 }], ingredients: [{ quantity: "1", unit: "l", name: "water" }] },
      { name: "Incomplete, no steps" },
    ],
    confirm: true,
  },
);
await call("import_recipes", { recipes: [{ name: "Only incomplete" }], confirm: true }, true);
const imported = await call("get_recipe", { id: "r_testimport01" });
check(imported.includes("Imported soup") && imported.includes("Boil"), "import saved the valid recipe");

// 5. copy the community recipe to mine, then clean up everything the test created
const copied = await call("save_copy_to_mine", { pubId });
const copyId = idFrom(copied);
await call("delete_recipe", { id: copyId, confirm: true });
await call("unpublish_recipe", { id, confirm: true });
await call("delete_recipe", { id, confirm: true });
await call("delete_recipe", { id, confirm: true }, true); // edge: already deleted
await call("delete_recipe", { id: "r_testimport01", confirm: true });

const untested = tools.tools.filter((t) => !tested.has(t.name)).map((t) => t.name);
console.log(`\nTools on server: ${tools.tools.length}. Untested tools: ${untested.join(", ") || "none"}. Problems: ${bad}`);
await client.close();
process.exit(bad || untested.length ? 1 : 0);
