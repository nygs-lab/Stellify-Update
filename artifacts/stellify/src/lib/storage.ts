import { requestUploadUrl } from "@workspace/api-client-react";

/**
 * Convert a stored object path (e.g. "/objects/uploads/<id>") into a URL that
 * the API server's storage route can serve.
 */
export function objectPathToUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("/objects/")) {
    return `/api/storage/objects/${path.slice("/objects/".length)}`;
  }
  return path;
}

/**
 * Request a presigned upload URL, PUT the file bytes directly to storage, and
 * return the normalized object path to persist (e.g. via profile update).
 */
export async function uploadFile(file: File): Promise<string> {
  const { uploadURL, objectPath } = await requestUploadUrl({
    name: file.name,
    size: file.size,
    contentType: file.type,
  });

  const put = await fetch(uploadURL, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
  if (!put.ok) {
    throw new Error(`Upload failed: ${put.status}`);
  }

  return objectPath;
}
