const express = require("express");

const app = express();
const port = process.env.PORT || 3000;
const sessionCookie = "nimops_demo_session";
const demoEmail = (process.env.DEMO_EMAIL || "gideon@nimops.example").trim().toLowerCase();
const demoPassword = process.env.DEMO_PASSWORD || "NimOps-demo-2026!";
const canonicalHosts = (process.env.CANONICAL_HOSTS || process.env.CANONICAL_HOST || "")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use((req, res, next) => {
  if (canonicalHosts.length === 0 || req.path === "/health") {
    next();
    return;
  }

  const requestHost = req.hostname.toLowerCase();
  if (canonicalHosts.includes(requestHost) || localHosts.has(requestHost)) {
    next();
    return;
  }

  res.status(403).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Cloudflare Required | NimOps Staff Portal</title>
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body>
    <main>
      <p class="eyebrow">403</p>
      <section class="narrow">
        <h1>Access through the Cloudflare-protected hostname.</h1>
        <p class="lede">Direct origin requests are blocked for this demo so traffic passes through Cloudflare security controls.</p>
        <div class="actions">
          <a class="button primary" href="https://${canonicalHosts[0]}">Open NimOps portal</a>
        </div>
      </section>
    </main>
  </body>
</html>`);
});

app.use(express.static("public"));

const parseCookies = (cookieHeader = "") =>
  Object.fromEntries(
    cookieHeader
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const separator = cookie.indexOf("=");
        if (separator === -1) return [cookie, ""];
        return [cookie.slice(0, separator), decodeURIComponent(cookie.slice(separator + 1))];
      })
  );

const getUser = (req) => {
  const cookies = parseCookies(req.headers.cookie);
  const email = cookies[sessionCookie];
  if (!email) return null;

  return {
    email,
    name: email.split("@")[0].replace(/[._-]/g, " "),
    region: req.headers["cf-ipcountry"] || "SG",
  };
};

const requireDemoSession = (req, res, next) => {
  const user = getUser(req);
  if (!user) {
    res.redirect("/?notice=session-required");
    return;
  }
  req.user = user;
  next();
};

const navLink = (active, key, href, label) =>
  `<a class="${active === key ? "active" : ""}" href="${href}">${label}</a>`;

const page = ({ title, eyebrow = "", body, active = "", user = null, shell = "default" }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title} | NimOps Staff Portal</title>
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body class="${shell}">
    <header class="site-header">
      <a class="brand" href="/" aria-label="NimOps home">
        <span class="brand-mark">N</span>
        <span>NimOps</span>
      </a>
      <nav aria-label="Primary">
        ${
          user
            ? [
                navLink(active, "dashboard", "/dashboard", "Dashboard"),
                navLink(active, "announcements", "/announcements", "Announcements"),
                navLink(active, "directory", "/directory", "Directory"),
                navLink(active, "requests", "/requests", "Requests"),
                navLink(active, "docs", "/docs", "Docs"),
              ].join("")
            : ""
        }
        ${user ? `<a href="/logout">Sign out</a>` : ""}
      </nav>
    </header>
    <main>
      ${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ""}
      ${body}
    </main>
  </body>
</html>`;

app.get("/", (req, res) => {
  const user = getUser(req);
  if (user) {
    res.redirect("/dashboard");
    return;
  }

  const notice =
    req.query.notice === "session-required"
      ? `<p class="notice">Please sign in before opening the staff dashboard.</p>`
      : req.query.notice === "invalid-login"
        ? `<p class="notice">The email or password was not recognized.</p>`
      : "";

  res.send(
    page({
      title: "Sign In",
      shell: "login-shell",
      eyebrow: "Internal access",
      body: `
        <section class="login-layout">
          <div class="login-copy">
            <h1>NimOps Staff Portal</h1>
            <p class="lede">Your hub for internal tools, team announcements, and operational dashboards — built for the people keeping NimOps infrastructure running.</p>
            <div class="trust-strip" aria-label="Security controls">
              <span>Cloudflare WAF</span>
              <span>Access SSO</span>
              <span>Workers</span>
            </div>
          </div>
          <form class="auth-card" method="post" action="/login">
            <div>
              <h2>Employee sign in</h2>
              <p>Use the configured demo credentials. Cloudflare Access will become the real authentication layer in deployment.</p>
            </div>
            ${notice}
            <label>
              Email
              <input name="email" type="email" value="${demoEmail}" autocomplete="username" required>
            </label>
            <label>
              Password
              <input name="password" type="password" autocomplete="current-password" required>
            </label>
            <button type="submit">Sign in</button>
          </form>
        </section>
      `,
    })
  );
});

app.post("/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (email !== demoEmail || password !== demoPassword) {
    res.redirect("/?notice=invalid-login");
    return;
  }

  res.cookie(sessionCookie, email, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60,
  });
  res.redirect("/dashboard");
});

app.get("/logout", (_req, res) => {
  res.clearCookie(sessionCookie);
  res.redirect("/");
});

app.get("/dashboard", requireDemoSession, (req, res) => {
  const displayName = req.user.name.replace(/\b\w/g, (letter) => letter.toUpperCase());

  res.send(
    page({
      title: "Dashboard",
      active: "dashboard",
      eyebrow: "Employee workspace",
      user: req.user,
      body: `
        <section class="dashboard-hero">
          <div>
            <h1>Good morning, ${displayName}</h1>
            <p class="lede">Your NimOps workspace brings company updates, regional access context, and Cloudflare-protected internal tools into one place.</p>
          </div>
          <aside class="profile-card" aria-label="Signed in employee">
            <span class="avatar">${req.user.email.slice(0, 1).toUpperCase()}</span>
            <strong>${req.user.email}</strong>
            <span>Detected region: ${req.user.region}</span>
          </aside>
        </section>
        <section class="metric-grid" aria-label="Portal metrics">
          <article>
            <span class="metric">98.9%</span>
            <p>Employee app availability</p>
          </article>
          <article>
            <span class="metric">12</span>
            <p>Access policies reviewed this week</p>
          </article>
          <article>
            <span class="metric">3</span>
            <p>Regional support updates pending</p>
          </article>
        </section>
        <section class="dashboard-grid" aria-label="Employee updates">
          <article class="panel large">
            <h2>Company announcements</h2>
            <ul class="updates">
              <li><strong>Security review:</strong> All teams should verify app access policies before Friday.</li>
              <li><strong>Regional rollout:</strong> Singapore and London teams are piloting the new support workflow.</li>
              <li><strong>Platform note:</strong> Customer-facing tools should route through Cloudflare by default.</li>
            </ul>
          </article>
          <article class="panel">
            <h2>Internal tools</h2>
            <a href="/announcements">Company announcements</a>
            <a href="/directory">People directory</a>
            <a href="/requests">IT request center</a>
            <a href="/docs">Employee docs</a>
          </article>
        </section>
        <section class="dashboard-grid" aria-label="Cloudflare demo links">
          <article class="panel">
            <h2>Cloudflare demo routes</h2>
            <a href="/secure">Identity check</a>
            <a href="/flags/SG">R2 flag demo</a>
            <a href="/flags-d1/SG">D1 flag demo</a>
          </article>
          <article class="panel large">
            <h2>Access posture</h2>
            <p class="status good">Ready for Cloudflare Access</p>
            <p>The dashboard and internal pages use local demo login now. In the final environment, Cloudflare Access should protect these employee routes before requests reach Render.</p>
          </article>
        </section>
      `,
    })
  );
});

app.get("/announcements", requireDemoSession, (req, res) => {
  res.send(
    page({
      title: "Announcements",
      active: "announcements",
      eyebrow: "Company updates",
      user: req.user,
      body: `
        <section class="narrow">
          <h1>Announcements</h1>
          <p class="lede">A simple internal news feed for operational updates, policy reminders, and regional launch notes.</p>
        </section>
        <section class="content-list" aria-label="Announcements">
          <article class="panel">
            <span class="tag">Security</span>
            <h2>Quarterly access review starts this week</h2>
            <p>Team leads should confirm application owners and remove stale access before Friday.</p>
          </article>
          <article class="panel">
            <span class="tag">Operations</span>
            <h2>Singapore support pilot expands to EMEA</h2>
            <p>The new incident routing workflow is now available to London and Dublin teams.</p>
          </article>
          <article class="panel">
            <span class="tag">Platform</span>
            <h2>New edge identity demo is ready</h2>
            <p>The Cloudflare Worker route will show authenticated user metadata and request country.</p>
          </article>
        </section>
      `,
    })
  );
});

app.get("/directory", requireDemoSession, (req, res) => {
  res.send(
    page({
      title: "Directory",
      active: "directory",
      eyebrow: "People",
      user: req.user,
      body: `
        <section class="narrow">
          <h1>People directory</h1>
          <p class="lede">A mock staff directory that makes the portal feel like a normal employee workspace.</p>
        </section>
        <section class="table-panel" aria-label="People directory">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Team</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Maya Chen</td>
                <td>Customer Engineering</td>
                <td>Singapore</td>
                <td><span class="pill good">Online</span></td>
              </tr>
              <tr>
                <td>Arjun Patel</td>
                <td>Security Operations</td>
                <td>London</td>
                <td><span class="pill">In review</span></td>
              </tr>
              <tr>
                <td>Elena Garcia</td>
                <td>Platform</td>
                <td>San Francisco</td>
                <td><span class="pill good">Online</span></td>
              </tr>
              <tr>
                <td>Noah Tan</td>
                <td>IT Support</td>
                <td>Singapore</td>
                <td><span class="pill">On call</span></td>
              </tr>
            </tbody>
          </table>
        </section>
      `,
    })
  );
});

app.get("/requests", requireDemoSession, (req, res) => {
  res.send(
    page({
      title: "Requests",
      active: "requests",
      eyebrow: "IT service desk",
      user: req.user,
      body: `
        <section class="narrow">
          <h1>Request center</h1>
          <p class="lede">Employees can see common IT and access requests. The form is static for the demo, but the route behaves like protected internal tooling.</p>
        </section>
        <section class="dashboard-grid" aria-label="Request types">
          <article class="panel">
            <h2>Application access</h2>
            <p>Request access to an internal dashboard or customer support tool.</p>
            <a href="/secure">Verify identity first</a>
          </article>
          <article class="panel">
            <h2>Device support</h2>
            <p>Open a helpdesk ticket for laptop, VPN replacement, or account recovery support.</p>
          </article>
          <article class="panel">
            <h2>Security exception</h2>
            <p>Submit a time-bound exception request for review by Security Operations.</p>
          </article>
        </section>
      `,
    })
  );
});

app.get("/docs", requireDemoSession, (req, res) => {
  res.send(
    page({
      title: "Docs",
      active: "docs",
      eyebrow: "Knowledge base",
      user: req.user,
      body: `
        <section class="narrow">
          <h1>Employee docs</h1>
          <p class="lede">Short internal guides for common staff workflows and security expectations.</p>
        </section>
        <section class="content-list" aria-label="Knowledge base articles">
          <article class="panel">
            <h2>How to request production access</h2>
            <p>Production access requires manager approval, SSO verification, and a documented business reason.</p>
          </article>
          <article class="panel">
            <h2>Incident response checklist</h2>
            <p>Confirm impact, identify owner, open a bridge, and keep status updates in the operating channel.</p>
          </article>
          <article class="panel">
            <h2>Working from a new country</h2>
            <p>Employees should expect location-aware access checks when signing in from a new region.</p>
          </article>
        </section>
      `,
    })
  );
});

app.post("/api/login-attempt", (req, res) => {
  res.status(401).json({
    ok: false,
    message: "Demo login rejected. Use this endpoint to demonstrate Cloudflare rate limiting.",
    received: {
      email: req.body.email || null,
    },
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "nimops-company-portal", timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).send(
    page({
      title: "Not Found",
      eyebrow: "404",
      body: `
        <section class="narrow">
          <h1>That route is not part of the origin app.</h1>
          <p class="lede">Worker-owned routes such as <code>/secure</code>, <code>/flags/:country</code>, and <code>/flags-d1/:country</code> are added later through Cloudflare Workers.</p>
          <div class="actions">
            <a class="button primary" href="/">Return home</a>
          </div>
        </section>
      `,
    })
  );
});

app.listen(port, () => {
  console.log(`NimOps Company Portal listening on port ${port}`);
});
