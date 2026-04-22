const STOCK_PREP_DATA_CHANGED_EVENT = "stock-prep:data-changed";

export function notifyStockPrepDataChanged(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(STOCK_PREP_DATA_CHANGED_EVENT));
}

export function subscribeToStockPrepDataChanged(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = () => {
    listener();
  };

  window.addEventListener(STOCK_PREP_DATA_CHANGED_EVENT, handleChange);

  return () => {
    window.removeEventListener(STOCK_PREP_DATA_CHANGED_EVENT, handleChange);
  };
}
