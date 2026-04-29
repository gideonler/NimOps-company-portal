# NimOps Company Portal

NimOps Company Portal is a fictional internal staff portal for a distributed company. The demo shows how Cloudflare can sit in front of the application to secure traffic, block common attacks, control access to sensitive pages, and serve personalized content at the edge.





## Repository Structure

```text
NimOps-company-portal/
├── README.md
├── package.json
├── package-lock.json
├── render.yaml
├── server.js
├── public/
│   └── styles.css
└── workers/
    └── nimops-edge/
        ├── wrangler.jsonc
        ├── src/
        │   └── index.js
        ├── assets/
        │   └── flags/
        │       ├── SG.svg
        │       └── US.svg
        └── sql/
            ├── schema.sql
            └── seed.sql
```

What each part does:

| Path | Purpose |
| --- | --- |
| `server.js` | Express origin app hosted on Render. It serves the staff portal, local demo login, protected internal pages, `/api/login-attempt`, `/health`, and app-level origin bypass protection. |
| `public/styles.css` | Styling for the Render-hosted portal UI. |
| `render.yaml` | Render deployment configuration, including build/start commands, health check path, and the `CANONICAL_HOSTS` environment variable. |
| `package.json` | Node app metadata, scripts, and Express dependency for the origin app. |
| `workers/nimops-edge/src/index.js` | Cloudflare Worker code for `/secure`, `/flags/:country`, and `/flags-d1/:country`. |
| `workers/nimops-edge/wrangler.jsonc` | Wrangler configuration for Worker routes plus R2 and D1 bindings. |
| `workers/nimops-edge/assets/flags/` | Local source copies of flag assets uploaded to R2 and encoded into D1. |
| `workers/nimops-edge/sql/schema.sql` | D1 table definition for storing flag assets. |
| `workers/nimops-edge/sql/seed.sql` | D1 seed data for the Singapore flag. |

The repo intentionally separates the **origin app** from the **edge Worker**:

```text
Render origin app: /, /dashboard, /directory, /requests, /docs, /api/login-attempt
Cloudflare Worker: /secure, /flags/:country, /flags-d1/:country
```




## Local Development

Install dependencies:

```bash
npm install
```

Run the origin app:

```bash
npm start
```

Open:

```text
http://localhost:3000
```



