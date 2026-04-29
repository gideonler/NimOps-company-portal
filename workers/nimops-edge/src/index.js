const FLAG_KEY_PREFIX = "flags/";
const DEFAULT_COUNTRY = "SG";

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const normalizeCountry = (country) => {
  const normalized = String(country || DEFAULT_COUNTRY).trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : DEFAULT_COUNTRY;
};

const getAuthenticatedEmail = (request) =>
  request.headers.get("cf-access-authenticated-user-email") ||
  request.headers.get("x-authenticated-user-email") ||
  "unknown-user@example.com";

const getRequestCountry = (request) => normalizeCountry(request.cf?.country || request.headers.get("cf-ipcountry"));

const getSingaporeTimestamp = () =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-SG", {
      timeZone: "Asia/Singapore",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value])
  );

const formatSingaporeTimestamp = () => {
  const parts = getSingaporeTimestamp();
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} SGT (UTC+8)`;
};

const htmlResponse = (body, init = {}) =>
  new Response(body, {
    ...init,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      ...init.headers,
    },
  });

const notFound = (message = "Not found") =>
  htmlResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Not Found | NimOps Edge</title>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(message)}</h1>
    </main>
  </body>
</html>`,
    { status: 404 }
  );

const secureResponse = (request) => {
  const email = getAuthenticatedEmail(request);
  const country = getRequestCountry(request);
  const timestamp = formatSingaporeTimestamp();
  const countryLink = `<a href="/flags/${country}">${country}</a>`;

  return htmlResponse(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>NimOps Secure Identity</title>
    <style>
      body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f7f8fb; color: #1f2937; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 32px; }
      section { max-width: 760px; background: white; border: 1px solid #dbe1ea; border-radius: 8px; padding: 28px; box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08); }
      p { font-size: 1.25rem; line-height: 1.6; margin: 0; }
      a { color: #0f766e; font-weight: 700; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <p>${escapeHtml(email)} authenticated at ${escapeHtml(timestamp)} from ${countryLink}</p>
      </section>
    </main>
  </body>
</html>`);
};

const flagFromR2 = async (env, country) => {
  const key = `${FLAG_KEY_PREFIX}${country}.svg`;
  const object = await env.FLAGS_BUCKET.get(key);

  if (!object) {
    return notFound(`No R2 flag found for ${country}`);
  }

  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType || "image/svg+xml",
      "cache-control": "public, max-age=300",
    },
  });
};

const flagFromD1 = async (env, country) => {
  const result = await env.FLAGS_DB.prepare(
    "SELECT content_type, body_base64 FROM flags WHERE country_code = ? LIMIT 1"
  )
    .bind(country)
    .first();

  if (!result) {
    return notFound(`No D1 flag found for ${country}`);
  }

  const bytes = Uint8Array.from(atob(result.body_base64), (char) => char.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      "content-type": result.content_type || "image/svg+xml",
      "cache-control": "public, max-age=300",
    },
  });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/secure") {
      return secureResponse(request);
    }

    const r2Match = path.match(/^\/flags\/([A-Za-z]{2})$/);
    if (r2Match) {
      return flagFromR2(env, normalizeCountry(r2Match[1]));
    }

    const d1Match = path.match(/^\/flags-d1\/([A-Za-z]{2})$/);
    if (d1Match) {
      return flagFromD1(env, normalizeCountry(d1Match[1]));
    }

    return notFound("That route is not handled by the NimOps Worker.");
  },
};
