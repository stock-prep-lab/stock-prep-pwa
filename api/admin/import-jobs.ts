import {
  handleCreateImportUploadSessionRequest,
  handleFinalizeImportUploadRequest,
  handleImportMarketZipRequest,
  handleListImportJobsRequest,
} from "../../apps/web/src/server/stockPrepApiHandlers.js";

type ImportScopeId = "FX" | "HK" | "JP" | "US";

type CreateImportUploadSessionRequestBody = {
  contentType: string;
  fileName: string;
  fileSize: number;
  scopeId: ImportScopeId;
};

type FinalizeImportUploadRequestBody = {
  finalizeToken: string;
};

function isScopeId(value: string): value is ImportScopeId {
  return value === "FX" || value === "HK" || value === "JP" || value === "US";
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

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as
        | ({ action: "prepare-upload" } & CreateImportUploadSessionRequestBody)
        | ({ action: "finalize-upload" } & FinalizeImportUploadRequestBody);

      if (body.action === "prepare-upload") {
        if (typeof body.scopeId !== "string" || !isScopeId(body.scopeId)) {
          return jsonErrorResponse("scopeId が不正です。", 400);
        }

        if (!body.fileName) {
          return jsonErrorResponse("fileName が必要です。", 400);
        }

        return Response.json(
          await handleCreateImportUploadSessionRequest({
            contentType: body.contentType,
            fileName: body.fileName,
            fileSize: body.fileSize,
            scopeId: body.scopeId,
          }),
        );
      }

      if (!body.finalizeToken) {
        return jsonErrorResponse("finalizeToken が必要です。", 400);
      }

      return Response.json(
        await handleFinalizeImportUploadRequest({
          finalizeToken: body.finalizeToken,
        }),
        { status: 201 },
      );
    }

    const formData = await request.formData();
    const scopeId = formData.get("scopeId");
    const file = formData.get("file");

    if (typeof scopeId !== "string" || !isScopeId(scopeId)) {
      return jsonErrorResponse("scopeId が不正です。", 400);
    }

    if (!(file instanceof File)) {
      return jsonErrorResponse("ZIP ファイルが必要です。", 400);
    }

    const job = await handleImportMarketZipRequest({
      fileName: file.name,
      scopeId,
      zipBytes: new Uint8Array(await file.arrayBuffer()),
    });

    return Response.json(job, { status: 201 });
  },
};

function jsonErrorResponse(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    status,
  });
}
