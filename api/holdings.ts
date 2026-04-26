import {
  handleGetHoldingsRequest,
  handleUpsertHoldingRequest,
} from "../apps/web/src/server/stockPrepApiHandlers.js";
import type { UpsertHoldingRequest } from "@stock-prep/shared";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "GET") {
      return Response.json(await handleGetHoldingsRequest());
    }

    if (request.method === "PUT") {
      return Response.json(
        await handleUpsertHoldingRequest((await request.json()) as UpsertHoldingRequest),
      );
    }

    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      headers: {
        "Allow": "GET, PUT",
        "Content-Type": "application/json; charset=utf-8",
      },
      status: 405,
    });
  },
};
