# Online Deployment

The public system uses three services:

- GitHub: source repository and GitHub Pages frontend
- Render: HTTPS Node/Express API
- Neon: managed PostgreSQL database

## 1. GitHub

Create a public repository named `emotional-translator`, then push this repository's `main` branch.

In the GitHub repository:

1. Open **Settings -> Pages**.
2. Set **Source** to **GitHub Actions**.
3. Open **Settings -> Secrets and variables -> Actions**.
4. Later, add `PRODUCTION_DATABASE_URL` with the Neon connection string for scheduled private backups.

The Pages workflow publishes only `index.html`, `styles.css`, `app.js`, `config.js`, `.nojekyll`, `data`, and `docs`. It does not publish the backend, local profile, screenshots, or secrets.

## 2. Neon PostgreSQL

Create a Neon project named `emotional-translator`, then copy its pooled PostgreSQL connection string. Keep it private.

The first Render deployment runs the database migration and seed automatically. It creates the approved graph from `data/color-synonyms.json`; it does not copy the exposed local password or local-only personal profile.

## 3. Render API

In Render, create a **Blueprint** from the GitHub repository. Render detects `render.yaml` and creates the free HTTPS web service `eli-emotional-translator-api`.

When prompted for `DATABASE_URL`, paste the private Neon connection string. Render generates and stores `AUTH_SECRET` itself.

After deployment, verify:

- `https://eli-emotional-translator-api.onrender.com/api/health`
- `https://eli-emotional-translator-api.onrender.com/api/v1/graph`

If Render assigns a different service hostname, update the production URL in `config.js`, commit, and push.

## 4. Final Verification

Open the GitHub Pages URL. The sidebar should show the production database connection and ask to create the first administrator account. Use a new password that has never appeared in a URL or local screenshot.

The production backup workflow runs daily and retains each private GitHub artifact for 30 days after the `PRODUCTION_DATABASE_URL` repository secret is configured.
