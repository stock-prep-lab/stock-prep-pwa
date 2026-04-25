import type { ImportJobRecord, ImportJobsPayload } from "@stock-prep/shared";

export async function fetchImportJobs(): Promise<ImportJobsPayload> {
  const response = await fetch("/api/admin/import-jobs");
  return readJsonResponse<ImportJobsPayload>(response);
}

export async function importBulkZip({
  file,
  scopeId,
}: {
  file: File;
  scopeId: ImportJobRecord["scopeId"];
}): Promise<ImportJobRecord> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("scopeId", scopeId);

  const response = await fetch("/api/admin/import-jobs", {
    body: formData,
    method: "POST",
  });

  return readJsonResponse<ImportJobRecord>(response);
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `API request failed: ${response.status}`;

    try {
      const errorPayload = (await response.json()) as { error?: string };
      message = errorPayload.error ?? message;
    } catch {
      // Ignore JSON parse errors and use the default message.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}
