// functions/index.ts — the entrypoint for your project's backend.
//
// This is a vanilla Cloudflare Worker. Add routes, fetch external APIs,
// and dispatch into Durable Object classes (declared in sibling files) by
// calling `env.DO.fetch(...)` with the X-Rork-DO-Class and X-Rork-DO-Id
// headers stamped on the request. See the backend/cloudflare skill for
// the full guide.

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ping") {
      return Response.json({ ok: true, now: new Date().toISOString() });
    }

    return Response.json({ ok: true, hello: "world" });
  },
};
