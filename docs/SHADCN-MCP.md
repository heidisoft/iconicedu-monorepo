# Shadcn MCP Server

Shadcn UI provides an MCP ("mini component playground") server to preview and experiment with components and design tokens while you build. The MCP server is a helpful complement to `shadcn:add` because it runs a live UI over a local component tree without having to spin up the full Next.js app.

## Next.js DevTools

If you prefer inspecting the component tree while running the full web app, Next.js ships with its own DevTools experience that can run alongside the MCP preview. Start the web dev server (`pnpm dev:web`) and then open the Next.js DevTools extension (or the browser-based Next DevTools when it is available) or visit `about:inspect` on the Next.js debugger tunnel to explore the component hierarchy, profiler, and server actions.

## Next.js App Router MCP

The App Router also exposes a built-in “MCP” (mini component playground) that documents how the router aligns with development tooling. Refer to the official guide before tweaking layout or page-loading behavior so you stay aligned with Next’s expectations: https://nextjs.org/docs/app/guides/mcp. Use it to validate server actions, streaming layouts, and client/server boundary contracts while keeping the shadcn MCP for UI preview.

Running both MCP and the Next.js dev server gives you the rapid component preview plus the full app instrumentation when you need to step through hooks, server actions, or layout/resolution logic.

## VS Code tips

- Use the Next.js DevTools extension in VS Code (search `Next.js` or open https://marketplace.visualstudio.com/items?itemName=stevencl.add-control) to get quick links into the DevTools panel while the server runs.  
- Launch `pnpm dev:web` inside the built-in terminal and use the Output/Terminal panel to monitor the server. The Next.js App Router MCP guide covers how to attach VS Code’s debugger once the server is live.  
- When editing shadcn components you can hit the MCP server via the browser, but keep VS Code’s integrated browser preview (Command+Shift+P → “Webview: Open Preview”) open if you want inline changes without switching apps.

## Running the server

1. `cd packages/ui-web`
2. Run `pnpm shadcn:mcp` — the script executes `pnpm dlx shadcn@latest mcp`, which starts the server and opens the browser automatically.
3. Follow the official guide if you need to configure custom components or themes: https://ui.shadcn.com/docs/mcp.

## Tips

- The MCP server reads the same `src/components` tree, so any component you add via `pnpm shadcn:add` appears in the MCP immediately after you refresh.
- Use `pnpm shadcn:mcp --help` for CLI options (preview mode, port, theme tokens, etc.).

## Workspace MCP servers (for AI tooling)

This repo now includes a root `.mcp.json` with MCP servers that match the stack:

- `filesystem`: safe file access scoped to this repo.
- `git`: inspect commit history and diffs.
- `postgres`: query the Supabase/Postgres database through `DATABASE_URL`.
- `fetch`: read docs and external HTTP resources.
- `nextjs`: Next.js framework/devtools MCP (`next-devtools-mcp`).
- `shadcn`: shadcn MCP via `pnpm dlx shadcn@latest mcp`.
- `prisma`: Prisma ORM MCP via `prisma mcp`.
- `supabase`: Supabase hosted MCP over remote transport.
- `playwright`: browser automation for UI checks (web app flows).

### Prerequisites

1. Set `DATABASE_URL` in your shell before starting your MCP client:
   `export DATABASE_URL="postgresql://..."`
2. Set `SUPABASE_ACCESS_TOKEN` if you want the Supabase hosted MCP:
   `export SUPABASE_ACCESS_TOKEN="..."`
3. Make sure Node and pnpm match project versions (`Node 20.18.1`, `pnpm 9.12.0`).
4. Use an MCP-compatible client that reads `.mcp.json` from the workspace root.

### Notes

- `postgres` uses `DATABASE_URL`; if it is missing, that server will fail to start.
- `nextjs` (`next-devtools-mcp`) is designed for modern Next.js setups and may expect Next.js 16+ features.
- `playwright` requires local browser dependencies; run `npx playwright install` if needed.
