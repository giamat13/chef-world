# Contributing

The connector lives next to the Chef World site. Its data model must match the site exactly, so read `../index.html` (the `ChefCloud` bridge and the recipe form) and `../firestore.rules` before changing a write.

## Setup

```bash
cd connector
npm install
npm run typecheck
```

## Run locally without Firebase

```bash
CHEF_MOCK=1 PORT=3000 npm run dev          # in-memory store, link key "mock"
npm test -- "http://localhost:3000/mcp?key=mock"
```

The test calls every tool in a realistic order and fails on an unexpected error, empty output, or any tool that was not called. Add every new tool to `scripts/test-client.ts` in the same change.

Use a fresh `PORT` each run. A stale dev server keeps answering on the old port with old code.

## Rules for changes

- Writes replace whole documents the way the site's `setDoc` does. Keep the field names and shapes from `src/lib/recipes.ts`.
- Anything that publishes or deletes needs `confirm` / `confirm_publish` set to `true`, and the tool description must say the user has to approve it first.
- Never log request URLs: the personal link travels in `?key=`.
- Errors that the user should see go through `UpstreamError` so the tool returns `isError` with a readable message.
- Card data is `kind: "page"` (see `src/lib/cards.ts`). Build text with `textContent` only in `src/view.ts`.
