const API_ACTIVITY_EVENT = "stock-prep:api-activity";

let inflightCount = 0;

export function subscribeToApiActivity(listener: (active: boolean) => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = () => {
    listener(inflightCount > 0);
  };

  window.addEventListener(API_ACTIVITY_EVENT, handleChange);

  return () => {
    window.removeEventListener(API_ACTIVITY_EVENT, handleChange);
  };
}

export function getApiActivitySnapshot(): boolean {
  return inflightCount > 0;
}

export async function fetchWithApiActivity(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  beginApiActivity();

  try {
    return await fetch(input, init);
  } finally {
    endApiActivity();
  }
}

export async function runWithApiActivity<T>(task: () => Promise<T>): Promise<T> {
  beginApiActivity();

  try {
    return await task();
  } finally {
    endApiActivity();
  }
}

function beginApiActivity(): void {
  inflightCount += 1;
  dispatchApiActivityEvent();
}

function endApiActivity(): void {
  inflightCount = Math.max(0, inflightCount - 1);
  dispatchApiActivityEvent();
}

function dispatchApiActivityEvent(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(API_ACTIVITY_EVENT));
}
