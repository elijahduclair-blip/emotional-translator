# Color Synonym Graph

Static web app for exploring the color synonym dataset in `data/color-synonyms.json`.

Production frontend: `https://elijahduclair-blip.github.io/emotional-translator/`

Search now runs through a path-first translator:

- Personal Shape input context
- graph path discovery
- ranked color landing
- existing evocative names from the landed family

The frontend uses a hybrid data loader. It keeps `data/color-synonyms.json` as the complete theory reference and checks `http://localhost:3000/api/v1/graph` for a live PostgreSQL graph overlay. If the API is offline or the database graph is empty, the app remains usable from the local atlas and shows its current source status in the sidebar.

Use **Theme system -> Shared graph** to govern PostgreSQL graph changes. Changes are proposals first, then separately reviewed and approved or rejected. Approved create, edit, and delete operations retain version history and can be undone. Relationships require structured evidence: source, evidence type, confidence, boundary, author, date, review status, and a falsification condition. PostgreSQL `nodes` and `edges` are the authority; theme, emotion, and common-word endpoints are derived from them. Baseline reseeding updates known records without deleting direct database entries.

Use **Theme system -> Research inbox** to search curated public reference sources without letting internet material rewrite the graph. The first sources are Wikipedia for orientation and Crossref for scholarly metadata. A saved result must include a boundary, confidence, and counterexample. It enters as `proposed`, requires administrator review, and can only create a separate graph proposal after approval. The graph still changes only through the existing graph-governance workflow.

Research queries are sent only to the public sources selected in the form. Account details and personal-profile entries are not included. Results are evidence leads rather than strict synonyms, diagnoses, or permanent identity claims.

## Authentication

The public atlas, graph, and translator remain readable without an account. Shared graph proposals, approval records, history, undo, and user profile endpoints require a signed account token.

On the first local run, use the account panel in the sidebar to create the first administrator. Passwords must contain at least 10 characters, including a letter and a number. The browser keeps the signed token in `sessionStorage`, so closing the browser session signs that browser out.

Administrators can review, approve, reject, and undo graph changes. Regular users can submit proposals but cannot alter approved truth directly. The API secret belongs only in `C:\Users\eli\Desktop\api\.env`; the API `.gitignore` excludes that file.

Signed-in users can change their password from the account panel. Password changes increment the account token version and invalidate every earlier browser session. Administrators can create accounts, change roles, require password rotation, and delete other accounts; the final administrator cannot be removed.

## Tests And Backups

Run the API security suite from `C:\Users\eli\Desktop\api`:

```powershell
npm.cmd test
```

Windows Task Scheduler runs `Emotional Translator Daily Backup` at 2:00 AM each day while the Windows user is signed in. The job writes PostgreSQL dumps and logs beneath `C:\Users\eli\Desktop\api\backups`, and removes dumps older than 30 days.

Theory notes:

- `docs/current-system-state.md` summarizes the current app, data layers, category system, and local-only Person 0 boundary.
- `docs/chatgpt-alignment-reference.json` is the AI-usable tool contract for interpreting the color-climate system outside the app.
- `docs/chatgpt-color-web-reference.md` is the human-readable companion reference for the same system.
- `docs/white-light-filter-theme.md` defines the upstream white light, filter, and theme layer.
- `docs/alignment-cross-domain-bridges.md` connects the color-climate anchors through myth, history, science, and arts.

## Run Locally

From this folder, start any static file server and open the printed URL:

```powershell
npx serve .
```

or:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173`.

Opening `index.html` directly may not load the JSON because browsers often block `fetch()` from local files.

## Put Online

This site is static. Host the whole folder with any static hosting service:

- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages

The required public files are:

- `index.html`
- `styles.css`
- `app.js`
- `data/color-synonyms.json`
- `docs/chatgpt-alignment-reference.json`

No build step is required.
