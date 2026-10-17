import { liveModelEnabled } from "./gemini";
import { activeStorage, storageNotice } from "./store";

export function readUser(request: Request): { id: string; name: string } | null {
  const id = request.headers.get("x-user-id")?.trim() ?? "";
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(id)) return null;
  const raw = request.headers.get("x-user-name") ?? "Student";
  let name = "Student";
  try {
    name = decodeURIComponent(raw).replace(/\s+/g, " ").trim().slice(0, 40) || "Student";
  } catch {
    name = "Student";
  }
  return { id, name };
}

export async function appStatus() {
  const storage = await activeStorage();
  return {
    liveModel: liveModelEnabled(),
    storage,
    storageNote: storageNotice(),
  };
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
