import {
  handleAddWatchlistSymbolRequest,
  handleRemoveWatchlistSymbolRequest,
} from "../apps/web/src/server/stockPrepApiHandlers.js";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "PUT") {
      return Response.json(await handleAddWatchlistSymbolRequest(await request.json()));
    }

    if (request.method === "DELETE") {
      const url = new URL(request.url);
      const symbolId = url.searchParams.get("symbolId");

      if (!symbolId) {
        return new Response(JSON.stringify({ error: "symbolId が必要です。" }), {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
          },
          status: 400,
        });
      }

      return Response.json(await handleRemoveWatchlistSymbolRequest(symbolId));
    }

    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      headers: {
        Allow: "PUT, DELETE",
        "Content-Type": "application/json; charset=utf-8",
      },
      status: 405,
    });
  },
};
