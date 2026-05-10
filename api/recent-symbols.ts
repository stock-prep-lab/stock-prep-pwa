import { handleRecordRecentSymbolRequest } from "../apps/web/src/server/stockPrepApiHandlers.js";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "PUT") {
      return Response.json(await handleRecordRecentSymbolRequest(await request.json()));
    }

    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      headers: {
        Allow: "PUT",
        "Content-Type": "application/json; charset=utf-8",
      },
      status: 405,
    });
  },
};
