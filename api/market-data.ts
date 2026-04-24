import { handleMarketDataRequest } from "../apps/web/src/server/stockPrepApiHandlers";

export default {
  async fetch(): Promise<Response> {
    return Response.json(await handleMarketDataRequest());
  },
};
