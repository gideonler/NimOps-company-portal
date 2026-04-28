# NimOps Company Portal


## Routes

| Route | Purpose |
| --- | --- |
| `/` | Demo employee sign-in screen |
| `/login` | Local demo session creation route |
| `/logout` | Clears the local demo session |
| `/dashboard` | Employee dashboard intended to be protected by Cloudflare Access |
| `/announcements` | Protected internal company updates |
| `/directory` | Protected mock people directory |
| `/requests` | Protected IT request center |
| `/docs` | Protected employee knowledge base |
| `/api/login-attempt` | POST endpoint intended for Cloudflare rate limiting demonstration |
| `/health` | Health check for Render |

Worker-owned routes such as `/secure`, `/flags/:country`, and `/flags-d1/:country` are intentionally not implemented here. Those should be added later through Cloudflare Workers, R2, and D1.

The local sign-in flow exists only to make the origin app feel realistic before Cloudflare is layered in. In the final demo, Cloudflare Access should protect `/dashboard` before requests reach Render.

## Demo Credentials

By default, local sign-in accepts:

```text
Email: gideon@nimops.example
Password: NimOps-demo-2026!
```

You can override these in Render or your shell:

```bash
DEMO_EMAIL="your-email@example.com"
DEMO_PASSWORD="choose-a-demo-password"
```

## Origin Bypass Protection

Set a canonical hostname in Render to reject direct origin traffic that does not use the Cloudflare-protected hostname:

```bash
CANONICAL_HOSTS="portal.gideonler.com"
```

When this variable is set, normal app routes only respond for the configured host. The Render health check route `/health` remains available so Render can keep monitoring the service.

Demo:

```text
https://portal.gideonler.com/                  # allowed through Cloudflare
https://nimops-company-portal.onrender.com/    # blocked by the app
```

This app-level check is useful for the take-home demo, but production origin bypass protection should prefer Cloudflare Tunnel, origin allowlisting to Cloudflare IP ranges, Authenticated Origin Pulls, or disabling the platform default domain when the host supports it.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Render Deployment

1. Push this project to a GitHub repository.
2. In Render, create a new Web Service from the repository.
3. Use these settings:
   - Runtime: Node
   - Build command: `npm install`
   - Start command: `npm start`
   - Health check path: `/health`
4. Deploy the service.
5. Add your Cloudflare-managed hostname as a custom domain in Render.
6. In Cloudflare DNS, create a proxied CNAME from your hostname to the Render target.

## Cloudflare Demo Mapping

- Cloudflare WAF Managed Rules: protect `/login` from SQL injection-style requests submitted through the main sign-in form.
- Cloudflare Rate Limiting: protect `POST /api/login-attempt` from repeated abuse.
- Cloudflare Access: protect `/dashboard` and the later Worker route `/secure`.
- Cloudflare Worker: later serves `/secure`, `/flags/:country`, and `/flags-d1/:country`.
- R2 and D1: later store and retrieve country flag assets.
