# Deploy Aptivo to Netlify

This project is a TanStack Start app (SSR on the edge). Netlify supports it via the official adapter without changing any application code.

## 1. One-time setup (local)

Install the Netlify adapter and register it in Vite:

```bash
bun add -D @netlify/vite-plugin-tanstack-start
```

Edit `vite.config.ts` and add the plugin BEFORE `tanstackStart()`:

```ts
import netlify from "@netlify/vite-plugin-tanstack-start";
// ...
export default defineConfig({
  plugins: [
    netlify(),          // add this
    tanstackStart(),    // keep existing
    // ...rest unchanged
  ],
});
```

Add a `netlify.toml` at the project root:

```toml
[build]
  command = "bun run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"
```

That is the entire code-side change. No routes, components, server functions, or DB code are touched.

## 2. Push to GitHub

Connect the repo to GitHub and push all changes.

## 3. Import on Netlify

1. Go to https://app.netlify.com/start
2. Pick "Import from Git" and select the repo.
3. Build command: `bun run build` (auto-detected)
4. Publish directory: `dist` (auto-detected)
5. Click **Deploy site**.

## 4. Environment variables

In Netlify, open **Site settings -> Environment variables** and add every value from your local `.env`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `AI_GATEWAY_KEY` (server-only, for the AI Gateway that powers CV tailoring / OCR / generation)
- `ELEVENLABS_API_KEY` (if used at runtime)
- Any other secrets your server functions read via `process.env`

Trigger a redeploy after adding them.

## 5. Custom domain (aptivoco.eu.cc)

**Site settings -> Domain management -> Add domain** -> enter `aptivoco.eu.cc`. Netlify will show two options:

- **CNAME** (subdomain): `CNAME @ <your-site>.netlify.app`
- **A record** (apex): point to Netlify's load balancer IP shown in the panel.

Add the DNS record at your registrar, wait for propagation, then enable **HTTPS (Let's Encrypt)** in the same panel.

## 6. Supabase redirect URLs

In the Supabase auth settings, add your new Netlify URLs to **Redirect URLs**:

- `https://<your-site>.netlify.app/**`
- `https://aptivoco.eu.cc/**`

Otherwise Google OAuth and magic links will reject the callback.

## Done

Every push to `main` now auto-deploys to Netlify.
