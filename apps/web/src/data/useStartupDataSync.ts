import { useEffect, useRef } from "react";

import { syncStockPrepData } from "./dataSync";

export function useStartupDataSync(): void {
  const isRunningRef = useRef(false);

  useEffect(() => {
    const runSync = async () => {
      if (isRunningRef.current) {
        return;
      }

      isRunningRef.current = true;

      try {
        await syncStockPrepData();
      } catch (error) {
        console.error("Failed to sync startup data.", error);
      } finally {
        isRunningRef.current = false;
      }
    };

    void runSync();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void runSync();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
