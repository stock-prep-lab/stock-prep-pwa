import { handleGetUserSymbolsRequest } from "../apps/web/src/server/stockPrepApiHandlers.js";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "GET") {
      return Response.json(await handleGetUserSymbolsRequest());
    }

    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      headers: {
        Allow: "GET",
        "Content-Type": "application/json; charset=utf-8",
      },
      status: 405,
    });
  },
};
