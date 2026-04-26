import type {
  CreateImportUploadSessionRequest,
  ImportJobRecord,
  ImportJobsPayload,
  ImportUploadSessionPayload,
} from "@stock-prep/shared";

export async function fetchImportJobs(): Promise<ImportJobsPayload> {
  const response = await fetch("/api/admin/import-jobs");
  return readJsonResponse<ImportJobsPayload>(response);
}

export async function importBulkZip({
  file,
  onProgress,
  onStageChange,
  scopeId,
}: {
  file: File;
  onProgress?: (progressPercent: number) => void;
  onStageChange?: (stage: "preparing" | "queueing" | "uploading") => void;
  scopeId: ImportJobRecord["scopeId"];
}): Promise<ImportJobRecord> {
  onStageChange?.("preparing");
  const uploadSession = await createImportUploadSession({
    contentType: file.type || "application/zip",
    fileName: file.name,
    fileSize: file.size,
    scopeId,
  });

  if (uploadSession.mode === "server-proxy") {
    return uploadViaServerProxy({ file, scopeId });
  }

  onStageChange?.("uploading");
  await uploadFileToR2({
    file,
    onProgress,
    uploadSession,
  });

  onStageChange?.("queueing");
  const response = await fetch("/api/admin/import-jobs", {
    body: JSON.stringify({
      action: "finalize-upload",
      finalizeToken: uploadSession.finalizeToken,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  return readJsonResponse<ImportJobRecord>(response);
}

async function createImportUploadSession(
  request: CreateImportUploadSessionRequest,
): Promise<ImportUploadSessionPayload> {
  const response = await fetch("/api/admin/import-jobs", {
    body: JSON.stringify({
      action: "prepare-upload",
      ...request,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  return readJsonResponse<ImportUploadSessionPayload>(response);
}

async function uploadViaServerProxy({
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

async function uploadFileToR2({
  file,
  onProgress,
  uploadSession,
}: {
  file: File;
  onProgress?: (progressPercent: number) => void;
  uploadSession: Extract<ImportUploadSessionPayload, { mode: "direct-r2" }>;
}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open(uploadSession.uploadMethod, uploadSession.uploadUrl);

    for (const [headerName, headerValue] of Object.entries(uploadSession.uploadHeaders)) {
      xhr.setRequestHeader(headerName, headerValue);
    }

    xhr.upload.addEventListener("progress", (event) => {
      if (!onProgress) {
        return;
      }

      if (!event.lengthComputable || event.total === 0) {
        onProgress(0);
        return;
      }

      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }

      reject(new Error(`R2 upload failed: ${xhr.status}`));
    });

    xhr.addEventListener("error", () => {
      reject(new Error("R2 upload failed."));
    });

    xhr.send(file);
  });
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
