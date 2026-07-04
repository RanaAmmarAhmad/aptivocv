# Aptivo CV

Aptivo is a TanStack Start app for tailoring a CV to a job description with Supabase auth, Supabase-backed storage, and AI Gateway-powered text generation/OCR.

## Demo

<video controls src="public/aptivo-demo.mp4" poster="public/aptivo-demo-poster.jpg" style="width:100%; border-radius:16px;">
  Your browser does not support the video tag.
</video>

## Tech Stack

- TanStack Start
- React 19
- Vite
- TypeScript
- Supabase-compatible backend
- AI Gateway for generation and OCR

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env.local` at the project root with:

```env
SUPABASE_PROJECT_ID=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=
VITE_SUPABASE_PROJECT_ID=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_URL=
AI_GATEWAY_KEY=
LOVABLE_API_KEY=
ELEVENLABS_API_KEY=
```

Notes:

- `AI_GATEWAY_KEY` is required for CV tailoring and OCR server functions.
- `LOVABLE_API_KEY` is kept only as a fallback name in some code paths.
- `ELEVENLABS_API_KEY` is only needed if voice features are used.

### 3. Run the app

```bash
npm run dev
```

The dev server runs on:

- `http://localhost:8080`

## Build and Preview

```bash
npm run build
npm run preview
```

## Important Environment Notes

- Google sign-in requires `http://localhost:8080/**` to be added to Supabase Auth redirect URLs.
- `SUPABASE_SERVICE_ROLE_KEY` is only needed for admin/quota paths in the server-side Supabase client. Normal auth and landing-page flows work without it.
- The AI Gateway key must come from the Lovable Cloud dashboard. Without it, generation endpoints return `Missing AI_GATEWAY_KEY`.

## Project Structure

- `src/routes/` contains the file-based TanStack Start routes.
- `src/lib/` contains server functions for CV parsing, generation, OCR, and exports.
- `src/integrations/supabase/` contains the Supabase client and auth middleware.

## License

No license file is included yet.
