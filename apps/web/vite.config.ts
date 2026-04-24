import type { IncomingMessage, ServerResponse } from "node:http";

import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

import {
  handleDatasetVersionRequest,
  handleGetHoldingsRequest,
  handleMarketDataRequest,
  handleUpsertHoldingRequest,
} from "./src/server/stockPrepApiHandlers";
import type { UpsertHoldingRequest } from "@stock-prep/shared";

export default defineConfig({
  plugins: [react(), stockPrepApiDevPlugin()],
});

function stockPrepApiDevPlugin(): Plugin {
  return {
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = request.url ? new URL(request.url, "http://localhost") : null;

        if (!url || !url.pathname.startsWith("/api/")) {
          next();
          return;
        }

        try {
          if (request.method === "GET" && url.pathname === "/api/dataset-version") {
            sendJson(
              response,
              200,
              await handleDatasetVersionRequest({
                localDatasetVersion: url.searchParams.get("localVersion"),
              }),
            );
            return;
          }

          if (request.method === "GET" && url.pathname === "/api/market-data") {
            sendJson(response, 200, await handleMarketDataRequest());
            return;
          }

          if (request.method === "GET" && url.pathname === "/api/holdings") {
            sendJson(response, 200, await handleGetHoldingsRequest());
            return;
          }

          if (request.method === "PUT" && url.pathname === "/api/holdings") {
            const body = (await readJsonBody(request)) as UpsertHoldingRequest;
            sendJson(response, 200, await handleUpsertHoldingRequest(body));
            return;
          }

          sendJson(response, 404, { error: "API route was not found." });
        } catch (error) {
          sendJson(response, 500, {
            error: error instanceof Error ? error.message : "API route failed.",
          });
        }
      });
    },
    name: "stock-prep-api-dev-plugin",
  };
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}
