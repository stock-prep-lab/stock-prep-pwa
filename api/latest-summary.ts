import { handleLatestSummaryRequest } from "../apps/web/src/server/stockPrepApiHandlers.js";

export async function GET(): Promise<Response> {
  try {
    return Response.json(await handleLatestSummaryRequest());
  } catch (error) {
    console.error("Failed to handle latest summary request.", error);
    return Response.json({ error: "Failed to load latest summary." }, { status: 500 });
  }
}
