import { handleMarketDataRequest } from "../apps/web/src/server/stockPrepApiHandlers.js";

export default {
  async fetch(): Promise<Response> {
    return Response.json(await handleMarketDataRequest());
  },
};
