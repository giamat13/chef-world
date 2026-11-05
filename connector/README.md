# Chef World connector

A remote MCP server that lets Claude work with your Chef World account: read, create, edit, favorite, mark cooked, publish, unpublish and delete your recipes, back them up, and browse and save community recipes. It runs as you, using your own sign-in, so Firestore's `firestore.rules` stay the only security boundary.

## Connect it

1. Deploy the connector (see below) and set `CLAUDE_CONNECTOR_URL` in `../index.html` to its `/mcp` URL.
2. In Chef World, sign in with an account (not a guest), click **🤖 Connect Claude**, and copy the link.
3. In claude.ai, add a custom connector with that link.

Anyone with the link acts as you. Signing out everywhere revokes it, and you can make a new link at any time.

## Tools

| Tool | What it does | Approval needed |
|---|---|---|
| `whoami` | Shows the account the link belongs to | no |
| `list_my_recipes` | Lists your recipes, with search, tag and favorites filters, the site's sort orders, and publication status | no |
| `get_recipe` | Full recipe with ingredients, steps, favorite, last cooked date and publication status; optional `units` (original, metric or us) | no |
| `create_recipe` | Creates a private recipe (same form as the site) | no |
| `update_recipe` | Edits a recipe; passed fields change, lists replace; favorite and cooked date are kept | no |
| `delete_recipe` | Deletes a private recipe; a published copy stays | yes (`confirm`) |
| `set_favorite` | Adds or removes one of your recipes from favorites (the site's ★) | no |
| `mark_cooked` | Records that you cooked a recipe now, as Cook mode does on the site | no |
| `publish_recipe` | Publishes as public or unlisted, in a chosen language; favorites and cooked dates stay private | yes (`confirm_publish`) |
| `unpublish_recipe` | Removes your published copy | yes (`confirm`) |
| `export_recipes` | Returns all your recipes as JSON in the site's backup format | no |
| `import_recipes` | Adds recipes from a backup (up to 100 per call); an existing id is overwritten | yes (`confirm`) |
| `list_community_recipes` | Browses public recipes by query, tag or language | no |
| `get_community_recipe` | Opens a community recipe by id or share link; optional `units` | no |
| `save_copy_to_mine` | Copies a community recipe into your recipes | no |
| `get_share_link` | Returns the share link of your published recipe | no |

Cards: results open in an inline card. Items in lists and sections are clickable, with a back button.

## Not reproduced from the site

- **AI import from text or a link** (the site's Gemini call). Claude does this directly: paste the text or the link into the chat and Claude calls `create_recipe`.
- **Manual translation** is only a preview in the site; it is not saved. Claude can translate the text in the chat.
- **Cook mode timers, step checkboxes, servings scaling and the screen wake lock** are local to the page. Starting Cook mode on the site is recorded by `mark_cooked`, which Claude calls when you ask.
- **Unit conversion** is shown in `get_recipe` and `get_community_recipe` (`units`). Saved data is never changed.
- **Import from a file** needs the file's text in the chat. For a large backup, import it in parts of up to 100 recipes.

## Run locally

```bash
npm install
CHEF_MOCK=1 PORT=3000 npm run dev
npm test -- "http://localhost:3000/mcp?key=mock"
```

## Deploy (Cloudflare Workers)

```bash
npx wrangler login
npm run deploy
```

Public settings live in `wrangler.toml` under `[vars]`: the Firebase web API key (public by design), the project id, and `SITE_URL`, which builds the share links. Set `SITE_URL` to the real address of the site.

After each deploy, remove the connector in claude.ai and add it again, because claude.ai caches the tool list.

## Security notes

- The personal link is used only for the request it arrives with. It is not stored or logged.
- Writes go through Firestore as the signed-in user, so only that user's recipes can change.
- `publish_recipe`, `unpublish_recipe`, `delete_recipe` and `import_recipes` require the explicit confirmation flag. The tool descriptions tell the model to get your approval first.
- Favorites and cooked dates are personal: they are never copied into a published recipe.
