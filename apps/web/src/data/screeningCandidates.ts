import { buildScreeningCandidates, type RankedScreeningCandidate } from "@stock-prep/domain";

import {
  createStockPrepDbRepository,
  loadStockPrepSnapshot,
  openStockPrepDb,
} from "../storage/stockPrepDb";

export type ScreeningCandidatesLoadResult = {
  candidates: RankedScreeningCandidate[];
  dailyPriceCount: number;
  symbolCount: number;
};

export async function loadScreeningCandidatesFromIndexedDb({
  limit = 20,
}: {
  limit?: number;
} = {}): Promise<ScreeningCandidatesLoadResult> {
  const db = await openStockPrepDb();

  try {
    const repository = createStockPrepDbRepository(db);
    const snapshot = await loadStockPrepSnapshot(repository);

    return {
      candidates: buildScreeningCandidates({
        dailyPrices: snapshot.dailyPrices,
        exchangeRates: snapshot.exchangeRates,
        limit,
        symbols: snapshot.symbols,
      }),
      dailyPriceCount: snapshot.dailyPrices.length,
      symbolCount: snapshot.symbols.length,
    };
  } finally {
    db.close();
  }
}
