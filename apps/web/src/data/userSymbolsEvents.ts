const USER_SYMBOLS_CHANGED_EVENT = "stock-prep:user-symbols-changed";

export function notifyUserSymbolsChanged(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(USER_SYMBOLS_CHANGED_EVENT));
}

export function subscribeToUserSymbolsChanged(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(USER_SYMBOLS_CHANGED_EVENT, listener);

  return () => {
    window.removeEventListener(USER_SYMBOLS_CHANGED_EVENT, listener);
  };
}
