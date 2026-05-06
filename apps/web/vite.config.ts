import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";

import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

import {
  handleDatasetVersionRequest,
  handleGetHoldingsRequest,
  handleImportMarketZipRequest,
  handleListImportJobsRequest,
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

          if (request.method === "GET" && url.pathname === "/api/admin/import-jobs") {
            sendJson(response, 200, await handleListImportJobsRequest());
            return;
          }

          if (request.method === "PUT" && url.pathname === "/api/holdings") {
            const body = (await readJsonBody(request)) as UpsertHoldingRequest;
            sendJson(response, 200, await handleUpsertHoldingRequest(body));
            return;
          }

          if (request.method === "POST" && url.pathname === "/api/admin/import-jobs") {
            const webRequest = await toWebRequest(request);
            const formData = await webRequest.formData();
            const scopeId = formData.get("scopeId");
            const file = formData.get("file");

            if (
              typeof scopeId !== "string" ||
              (scopeId !== "FX" &&
                scopeId !== "HK" &&
                scopeId !== "JP" &&
                scopeId !== "US")
            ) {
              sendJson(response, 400, { error: "scopeId が不正です。" });
              return;
            }

            if (!(file instanceof File)) {
              sendJson(response, 400, { error: "ZIP ファイルが必要です。" });
              return;
            }

            sendJson(
              response,
              201,
              await handleImportMarketZipRequest({
                fileName: file.name,
                scopeId,
                zipBytes: new Uint8Array(await file.arrayBuffer()),
              }),
            );
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

async function toWebRequest(request: IncomingMessage): Promise<Request> {
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
      continue;
    }

    if (typeof value === "string") {
      headers.set(key, value);
    }
  }

  const init = {
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : (Readable.toWeb(request) as unknown as ReadableStream<Uint8Array>),
    duplex: "half",
    headers,
    method: request.method,
  } as RequestInit & { duplex?: "half" };

  return new Request(`http://localhost${request.url ?? "/"}`, init);
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
