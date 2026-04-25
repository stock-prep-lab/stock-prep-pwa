import { handleImportMarketZipRequest, handleListImportJobsRequest } from "../../apps/web/src/server/stockPrepApiHandlers";
import type { ImportJobRecord } from "@stock-prep/shared";

function isScopeId(value: string): value is ImportJobRecord["scopeId"] {
  return value === "FX" || value === "HK" || value === "JP" || value === "UK" || value === "US";
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "GET") {
      return Response.json(await handleListImportJobsRequest());
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        headers: {
          Allow: "GET, POST",
          "Content-Type": "application/json; charset=utf-8",
        },
        status: 405,
      });
    }

    const formData = await request.formData();
    const scopeId = formData.get("scopeId");
    const file = formData.get("file");

    if (typeof scopeId !== "string" || !isScopeId(scopeId)) {
      return new Response(JSON.stringify({ error: "scopeId が不正です。" }), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        status: 400,
      });
    }

    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "ZIP ファイルが必要です。" }), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        status: 400,
      });
    }

    const job = await handleImportMarketZipRequest({
      fileName: file.name,
      scopeId,
      zipBytes: new Uint8Array(await file.arrayBuffer()),
    });

    return Response.json(job, { status: 201 });
  },
};
