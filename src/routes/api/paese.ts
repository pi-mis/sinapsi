import { createFileRoute } from "@tanstack/react-router";

/** Country of the connection (from the edge), used once to pick the default language. */
export const Route = createFileRoute("/api/paese")({
  server: {
    handlers: {
      GET: ({ request }) =>
        Response.json(
          { country: request.headers.get("cf-ipcountry") ?? null },
          { headers: { "cache-control": "no-store" } },
        ),
    },
  },
});
