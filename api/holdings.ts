import {
  handleDeleteHoldingRequest,
  handleGetHoldingsRequest,
  handleUpsertHoldingRequest,
} from "../apps/web/src/server/stockPrepApiHandlers.js";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "GET") {
      return Response.json(await handleGetHoldingsRequest());
    }

    if (request.method === "PUT") {
      return Response.json(await handleUpsertHoldingRequest(await request.json()));
    }

    if (request.method === "DELETE") {
      const { searchParams } = new URL(request.url);
      const symbolId = searchParams.get("symbolId");

      if (!symbolId) {
        return new Response(JSON.stringify({ error: "symbolId is required" }), {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
          },
          status: 400,
        });
      }

      return Response.json(await handleDeleteHoldingRequest(symbolId));
    }

    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      headers: {
        "Allow": "GET, PUT, DELETE",
        "Content-Type": "application/json; charset=utf-8",
      },
      status: 405,
    });
  },
};
