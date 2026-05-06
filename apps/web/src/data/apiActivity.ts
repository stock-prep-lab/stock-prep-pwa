const API_ACTIVITY_EVENT = "stock-prep:api-activity";
const BACKGROUND_API_ACTIVITY_EVENT = "stock-prep:background-api-activity";

let backgroundInflightCount = 0;
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

export function subscribeToBackgroundApiActivity(listener: (active: boolean) => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = () => {
    listener(backgroundInflightCount > 0);
  };

  window.addEventListener(BACKGROUND_API_ACTIVITY_EVENT, handleChange);

  return () => {
    window.removeEventListener(BACKGROUND_API_ACTIVITY_EVENT, handleChange);
  };
}

export function getApiActivitySnapshot(): boolean {
  return inflightCount > 0;
}

export function getBackgroundApiActivitySnapshot(): boolean {
  return backgroundInflightCount > 0;
}

export async function fetchWithApiActivity(
  input: RequestInfo | URL,
  init?: RequestInit,
  {
    activity = "foreground",
  }: {
    activity?: "background" | "foreground";
  } = {},
): Promise<Response> {
  beginApiActivity(activity);

  try {
    return await fetch(input, init);
  } finally {
    endApiActivity(activity);
  }
}

export async function runWithApiActivity<T>(
  task: () => Promise<T>,
  {
    activity = "foreground",
  }: {
    activity?: "background" | "foreground";
  } = {},
): Promise<T> {
  beginApiActivity(activity);

  try {
    return await task();
  } finally {
    endApiActivity(activity);
  }
}

function beginApiActivity(activity: "background" | "foreground"): void {
  if (activity === "background") {
    backgroundInflightCount += 1;
    dispatchBackgroundApiActivityEvent();
    return;
  }

  inflightCount += 1;
  dispatchForegroundApiActivityEvent();
}

function endApiActivity(activity: "background" | "foreground"): void {
  if (activity === "background") {
    backgroundInflightCount = Math.max(0, backgroundInflightCount - 1);
    dispatchBackgroundApiActivityEvent();
    return;
  }

  inflightCount = Math.max(0, inflightCount - 1);
  dispatchForegroundApiActivityEvent();
}

function dispatchForegroundApiActivityEvent(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(API_ACTIVITY_EVENT));
}

function dispatchBackgroundApiActivityEvent(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(BACKGROUND_API_ACTIVITY_EVENT));
}
