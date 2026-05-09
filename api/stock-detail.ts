import { handleStockDetailRequest } from "../apps/web/src/server/stockPrepApiHandlers.js";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const symbolCode = url.searchParams.get("code")?.trim() ?? "";
    const region = url.searchParams.get("region")?.trim() ?? null;

    if (!symbolCode) {
      return Response.json({ error: "code query is required." }, { status: 400 });
    }

    const payload = await handleStockDetailRequest({
      region: region === "JP" || region === "US" || region === "HK" ? region : null,
      symbolCode,
    });

    if (!payload) {
      return Response.json({ error: "Stock detail not found." }, { status: 404 });
    }

    return Response.json(payload);
  } catch (error) {
    console.error("Failed to handle stock detail request.", error);
    return Response.json({ error: "Failed to load stock detail." }, { status: 500 });
  }
}
