import { handleDatasetVersionRequest } from "../apps/web/src/server/stockPrepApiHandlers.js";

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const payload = await handleDatasetVersionRequest({
      localDatasetVersion: url.searchParams.get("localVersion"),
    });

    return Response.json(payload);
  },
};
